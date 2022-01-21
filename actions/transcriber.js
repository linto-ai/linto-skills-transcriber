const debug = require('debug')(`linto:skill:v2:linto-skill:transcribe:actions:transcriber`)

const DEFAULT_MAX_SIZE_FILE = 10  // Mo
const BYTE_SIZE = 1024

module.exports = async function (msg) {
  const tts = this.tts[this.getFlowConfig('language').language]
  try {
    return {
      jobs: 'Will manage jobs soon'
    }
  } catch (err) {
    return {error: tts.say.processingError.text}  
  }
}
