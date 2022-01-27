const debug = require('debug')(`linto:skill:v2:linto-skill:transcribe:controllers:getTranscriptionResult`)
const REQUEST_ACCEPT_FORMAT = ['application/json', 'text/plain', 'text/vtt', 'text/srt']

module.exports = async function (msg, conf) {
  try{ 
    const url = `${conf.host}/results/${msg.payload.result_id}` 
    let options = {
      headers : {}
    }

    if(msg.payload.accept && REQUEST_ACCEPT_FORMAT.indexOf(msg.payload.accept) > -1){
      options.headers.accept = msg.payload.accept
    }else {
      options.headers.accept = REQUEST_ACCEPT_FORMAT[0] // By default application/json
    }

    const result = await this.request.get(url, options, resultHandler)

    if(options.headers.accept === 'application/json'){
      return JSON.parse(result)
    }
    return result

  }catch(err){
    throw new Error('Service error')
  }
}

const resultHandler = function (error, response, body) {
  if (error) 
    return error
  if (response === undefined || response.statusCode >= 400) {
    new Error('Service error')
  }
  console.log(body)
  return body
}