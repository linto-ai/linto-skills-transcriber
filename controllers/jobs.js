const debug = require('debug')(`linto:skill:v2:linto-skill:transcribe:controllers:jobs`)
const DEFAULT_OPTION = {
  headers : { accept : 'application/json'}
}

module.exports = async function (msg) {
  const url = `${conf.host}/job/${msg.payload.job_id}` 

  let jobsResult = await this.request.get(url, DEFAULT_OPTION, jobsHandler)
  return {
    jobs: jobsResult
  }
}

const jobsHandler = function (error, response, body) {
  if (error) 
    return error
  if (response === undefined || response.statusCode >= 400) {
    new Error('Service error')
  }
  console.log(body)
  return body
}