const debug = require('debug')(`linto:skill:v2:linto-skill:transcribe:controllers:getTranscriptionResult`)
const REQUEST_ACCEPT_FORMAT = ['application/json', 'text/plain', 'text/vtt', 'text/srt']
const STATE_RESULT_RECEIVE = 'result_received'

module.exports = async function (msg, conf) {
  try{
    let url = `${conf.host}/results/${msg.payload.result_id}`
    let options = {
      headers : {}
    }

    if(msg.payload.convert_numbers || msg.payload.return_raw){
      url += `?`
      if(msg.payload.convert_numbers)
        url +=`convert_numbers=${msg.payload.convert_numbers}&`
      if(msg.payload.return_raw)
        url +=`return_raw=${msg.payload.return_raw}&`
    }

    if(msg.payload.accept && REQUEST_ACCEPT_FORMAT.indexOf(msg.payload.accept) > -1){
      options.headers.accept = msg.payload.accept
    }else {
      options.headers.accept = REQUEST_ACCEPT_FORMAT[0] // By default application/json
    }

    const result = await this.request.get(url, options, resultHandler)

    let json = {
      state : STATE_RESULT_RECEIVE,
      type : options.headers.accept
    }
    if(options.headers.accept === 'application/json'){
      json.result = JSON.parse(result)
    }else {
      json.result = result
    }

    return json
  }catch(err){
    return {
      state : 'error',
      error : err.message
    }
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