const debug = require('debug')(`linto:skill:v2:linto-skill:transcribe:controllers:stt`)

module.exports = async function (msg) {
  try {
    const tts = this.tts[this.getFlowConfig('language').language]

    const actionConf = this.config.transcriber.find(conf=> conf.action === msg.data.trigger.action)
    if (!actionConf.host)
      return { error: tts.say.missingParameterHost.text }
    else if(msg.payload.audio)
      return await this.controller.fileUpload(msg, actionConf)
    else if(msg.payload.job_id)
      return await this.controller.jobs(msg, actionConf)
    else
      return { error: tts.say.missingParameter.text }
  } catch (err) {
      console.log(err)
      return { error: tts.say.processingError.text }
  }
}