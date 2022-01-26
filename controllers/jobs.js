const debug = require('debug')(`linto:skill:v2:linto-skill:transcribe:controllers:jobs`)

module.exports = async function (msg) {
  const url = `${conf.host}/job/${msg.payload.job_id}` 
  const options = {
    headers : { accept : 'application/json'},
  }
  
  let jobsResult = await this.request.get(url, options, jobsHandler)
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