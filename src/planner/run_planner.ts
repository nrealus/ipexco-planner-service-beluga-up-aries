import {spawn} from 'child_process';
import * as fs from 'fs';
import { Job } from '@hokify/agenda';
import { PlannerRequest, PlanRunStatus } from '../domain/service_communication';
import { Action } from '../domain/action_set';
import { cleanUpExperimentEnvironment, setupExperimentEnvironment } from './experiment_utils';
import { PlanRun } from '../domain/plan-run';


export function create_temp_goal_plan_run(request: PlannerRequest): PlanRun {
  return {
    request,
    status: PlanRunStatus.PENDING,
    experiment_path: process.env.TEMP_RUN_FOLDERS + '/' + request.id,
    planner: process.env.PLANNER_SERVICE_PLANNER,
    args: [
      'solve',
      'problem_base.json',
      'problem_props.json',
    ]
  }
}


export async function schedule_run(plan_run: PlanRun, job: Job<any>) {

    const request = plan_run.request;

    if(plan_run.status !== PlanRunStatus.PENDING){
      console.log('Do not run again: ' + plan_run.request.id);
      return;
    }

    setupExperimentEnvironment(request.model, 
      {
        plan_properties: request.goals, 
        hard_goals: request.hardGoals, 
        soft_goals: []
      }, 
      plan_run.experiment_path);  

    const sendBack = await runPlanner(plan_run, job);
    if(! sendBack){
      console.log('Do not send response: ' + plan_run.request.id);
	    cleanUpExperimentEnvironment(plan_run.experiment_path)
      return
    }

	  sendResults(plan_run);

    job.attrs.data[1] = plan_run;
    job.save();

    cleanUpExperimentEnvironment(plan_run.experiment_path)

  }


function runPlanner(plan_run: PlanRun, job: Job<any>): Promise<boolean> {

    return new Promise(function (resolve, reject) {

      // check if run has not already been done/ experiment folder still exists
      // if(!fs.existsSync(plan_run.experiment_path)){
      //   console.log('Experiment folder does not exists anymore');
      //   return resolve(false)
      // }

      plan_run.status = PlanRunStatus.RUNNING
      job.attrs.data[1] = plan_run;
      job.save();
      let args = plan_run.args

      // console.log(plan_run.planner + ' ' + args.join(' '))

      const options = {
        cwd: plan_run.experiment_path,
        env: process.env,
      };

      let planProcess = null;
      try{
        planProcess = spawn(plan_run.planner, args, options);
      }
      catch(err){
        plan_run.status = PlanRunStatus.FAILED
        resolve(true);
      }

      //store process id so job can be canceled
      job.attrs.data.push(planProcess.pid);
      job.save();

      if(process.env.DEBUG_OUTPUT == 'true'){
        planProcess.stdout.on('data', (data) => {
          console.log(`stdout: ${data}`);
        });
        
        planProcess.stderr.on('data', (data) => {
          console.error(`stderr: ${data}`);
        });
      }

      planProcess.on('close', function (code) { 
        switch(code) {
          case 0:
            plan_run.status = PlanRunStatus.SOLVED;
            break;
          case 2:
            plan_run.status = PlanRunStatus.UNSOLVABLE;
            break;
          default:
            plan_run.status = PlanRunStatus.FAILED;
            break;
        }
        if(process.env.DEBUG_OUTPUT === 'true'){
          console.log("ReturnCode: " + code);
        }
        return resolve(true);
      });
      planProcess.on('error', function (err) {
        plan_run.status = PlanRunStatus.FAILED;
        return reject(true);
      });
    });
  }

  
function get_plan(plan_run: PlanRun): Action[] {
  if(plan_run.status != PlanRunStatus.SOLVED){
    return null
  }

  let plan_path = plan_run.experiment_path + '/output/plan/plan.json'

  let raw_plan = fs.readFileSync(plan_path,'utf8');
  let actions: Action[] = JSON.parse(raw_plan);

  if(process.env.DEBUG_OUTPUT === 'true'){
    console.log(actions)
  }
  return actions
}


function sendResults(plan_run: PlanRun) {

  const request = plan_run.request;

  let data = {
      id: request.id,
      status: plan_run.status,
      actions: []
  }

  if(plan_run.status == PlanRunStatus.SOLVED){
      data.actions = get_plan(plan_run)
  }

  let payload = JSON.stringify(data);

  if(process.env.DEBUG_OUTPUT === 'true'){
    console.log("PAYLOAD:")
    console.log(payload)
  }

  const callbackRequest = new Request(plan_run.request.callback, 
    {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": 'Bearer ' + process.env.SERVICE_KEY
        },
        body: payload,
    }
  )

  fetch(callbackRequest).then
          (resp => {
            if(process.env.DEBUG_OUTPUT === 'true'){
              console.log("callback sent: " + plan_run.request.id)
              console.log("got response:", resp.status)
            }
          },
          error => console.log('Request: ' + plan_run.request.id + " " + error)
      )
}

