const debug = require('debug')('linto:skill:v2:linto-skill:transcriber')
const LintoSkillNode = require('@linto-ai/linto-components').nodes.lintoSkillNode
const { payloadAction, template, request } = require('@linto-ai/linto-components').components

const PALETTE_NODE_NAME = 'File transcriber'
const SKILL_NAME = 'linto-skill-transcriber'
const tts = require('./data/tts')

module.exports = function (RED) {
  function Node(config) {
    RED.nodes.createNode(this, config)
    new LintoSkillTranscriber(RED, this, config)
  }

  RED.nodes.registerType(SKILL_NAME, Node,
    {
      settings: {
        lintoSkillTranscriber: {
          value: {
            skillName: SKILL_NAME,  // CHECK HERE
            template: template.settupSkillTemplate(PALETTE_NODE_NAME),
            command: LintoSkillNode.loadFile(__dirname, 'data/command.md'),
          },
          exportable: true
        }
      }
    })
}

class LintoSkillTranscriber extends LintoSkillNode {
  constructor(RED, node, config) {
    super(RED, node, config, __dirname)
    this.payloadAction = payloadAction

    this.config = {
      ...config
    }

    const skillName = this.node.type.replace('linto-skill-', '')
    this.config.transcriber.map(conf => {
      this.registerAction(`${skillName}-${conf.action}`, require('./controllers/stt'))
    })

    this.tts = tts

    this.request = request
    this.init()
  }

  async init() {
    await this.configure() // Autoload controllers
  }
}