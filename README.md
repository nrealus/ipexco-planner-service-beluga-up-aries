(Adapted from: [https://github.com/r-eifler/planner-service](https://github.com/r-eifler/planner-service))

# Up/Aries Planner Service for IPEXCO Platform

### Environment

The following environment variables can be defined, either in a `.env` file 
if you run the service natively on your machine or in an environment file 
for the docker image. 

- `PORT`: port used by the web server of the service (default: `3333`)
- `CONCURRENT_PLANNER_RUNS`: maximal number if job scheduled concurrently
- `DEBUG_OUTPUT`: print debug output
- `MONGO_DB`: URL of the MongoDB database with a unique name used by the job 
    scheduler of the service
- `API_KEY`: a random string that is used to authenticate a request from the 
    back-end to a service
- `SERVICE_KEY`: a random string that is used to authenticate any registered 
    services, e.g. planner

**Attention**: If you register a new service in the web interface, then 
requested API Key and the `API_KEY` defined in the service environment 
must match

The following variables are only required, if the service is run natively:

- `TEMP_RUN_FOLDERS`: path to a folder to store the input of the planner and 
    its intermediate results
- `PLANNER_SERVICE_PLANNER`: path to the planner executable/script (`beluga/beluga.py`)
- `MAX_NUM_AVAILABLE_SWAPS`: maximum number of possible "swaps" to be used in plans
