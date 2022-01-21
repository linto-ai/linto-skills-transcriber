const debug = require('debug')(`linto:skill:v2:linto-skill:transcribe:controllers:stt`)

const DEFAULT_MAX_SIZE_FILE = 10  // Mo
const BYTE_SIZE = 1024

module.exports = async function (msg) {
  const tts = this.tts[this.getFlowConfig('language').language]

  try {
    let audio = msg.payload.audio
    if (audio) {
      let audioBuffer = Buffer.from(audio.split("base64,").pop(), 'base64')
      delete msg.payload.audio

      let host, maxBufferSize
      this.config.transcriber.map(conf => {
        if(conf.action === msg.data.trigger.action){
          host = conf.host
          maxBufferSize = conf.filesize
        }
      })
      if (!host) throw new Error('Configuration missing')


      if (Buffer.isBuffer(audioBuffer)) {

        checkFileSize(Buffer.byteLength(audioBuffer), this.config.maxBufferSize )
        let format = generateAudioFormat(msg.payload.format)
        let transcriptionConfig = generateTranscriptionConfig(msg.payload.transcriptionConfig)

        let options = prepareRequest(audioBuffer, format, transcriptionConfig)

        let transcriptResult = await this.request.post(host, options)
        const transcription = wrapperLinstt(transcriptResult, options)
        return {
          transcript: transcription
        }
      }
    }else 
      return {error:'Input should containt an audio buffer'}
  } catch (err) {
    console.log(err)
    return {error: tts.say.processingError.text}  
  }
}

function generateTranscriptionConfig(reqConfig){
  let config = {
    transcribePerChannel: false,
    enablePunctuation: false,
    diarizationConfig: {
      enableDiarization: false,
      numberOfSpeaker: 0,
      maxNumberOfSpeaker: 0
    },
    subtitleConfig: {
      enableSubtitle: false,
      subtitleFormat: "VTT",
      maxCharacterPerLine: 0,
      returnAsFile: false
    },
    returnPart: false
  }

  if(reqConfig.transcribePerChannel) config.transcribePerChannel = reqConfig.transcribePerChannel
  if(reqConfig.enablePunctuation) config.enablePunctuation = reqConfig.enablePunctuation
  if(reqConfig.diarizationConfig){
    if(reqConfig.diarizationConfig.enableDiarization) config.diarizationConfig.enableDiarization = reqConfig.diarizationConfig.enableDiarization
    if(reqConfig.diarizationConfig.numberOfSpeaker) config.diarizationConfig.numberOfSpeaker = reqConfig.diarizationConfig.numberOfSpeaker
    if(reqConfig.diarizationConfig.maxNumberOfSpeaker) config.diarizationConfig.maxNumberOfSpeaker = reqConfig.diarizationConfig.maxNumberOfSpeaker
  }

  if(reqConfig.subtitleConfig){
    if(reqConfig.subtitleConfig.enableSubtitle) config.subtitleConfig.enableSubtitle = reqConfig.subtitleConfig.enableSubtitle
    if(reqConfig.subtitleConfig.subtitleFormat) config.subtitleConfig.subtitleFormat = reqConfig.subtitleConfig.subtitleFormat
    if(reqConfig.subtitleConfig.maxCharacterPerLine) config.subtitleConfig.maxCharacterPerLine = reqConfig.subtitleConfig.maxCharacterPerLine
    if(reqConfig.subtitleConfig.returnAsFile) config.subtitleConfig.returnAsFile = reqConfig.subtitleConfig.returnAsFile
  }
  if(reqConfig.returnPart) config.returnPart = reqConfig.returnPart

  return JSON.stringify(reqConfig)
}

function checkFileSize(bufferSize, maxBufferSize){
  let bufferMoSize = bufferSize / BYTE_SIZE / BYTE_SIZE // convert to Mo

  if(maxBufferSize === undefined || maxBufferSize === '')
    maxBufferSize = DEFAULT_MAX_SIZE_FILE

  if((maxBufferSize - bufferMoSize ) > 0)
    return true

  throw new Error('File is to big')
}

function generateAudioFormat(requestedFormat){
  let format = 'text/plain'
  if(requestedFormat === 'json' || requestedFormat === 'application/json')
    format = 'application/json'
  return format
}

function prepareRequest(buffer, formatRequested, transcriptionConfig) {
  let accept = formatRequested

  let options = {
    headers: {
      accept
    },
    formData: {
      file: {
        value: buffer,
        options: {
          filename: 'wavFile',
          type: 'audio/wav',
          contentType: 'audio/wav'
        }
      },
      transcriptionConfig,
      force_sync: 'true'
    },
    encoding: null
  }
  return options
}

function wrapperLinstt(transcript, options) {
  let output = {text : ""}
  if (options.headers.accept === 'application/json') {
    let jsonTranscript = JSON.parse(transcript)

    if (!jsonTranscript || jsonTranscript.transcription_result.length === 0) 
      throw new Error('Transcription was empty')

    output.text = jsonTranscript.transcription_result
    output.confidenceScore = jsonTranscript.confidence

    const transcriptionConfig = JSON.parse(options.formData.transcriptionConfig)
    if(transcriptionConfig.diarizationConfig.enableDiarization === true)
      output.segments = jsonTranscript.segments

  } else {
    output.text = transcript.toString('utf8')
    if (output.text === undefined || output.text.length === 0) 
      throw new Error('Transcription was empty')
  }
  return output
}