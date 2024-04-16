import { botName, Chouqian } from '../../config.js'
import { getServe } from './serve.js'

/**
 * 默认消息发送
 * @param msg
 * @param bot
 * @param ServiceType 服务类型 'GPT' | 'Kimi'
 * @returns {Promise<void>}
 */
export async function defaultMessage(msg, bot, ServiceType = 'GPT') {
  const getReply = getServe(ServiceType)
  const contact = msg.talker() // 发消息人
  const receiver = msg.to() // 消息接收人
  const content = msg.text() // 消息内容
  const room = msg.room() // 是否是群消息
  const roomName = (await room?.topic()) || null // 群名称
  const alias = (await contact.alias()) || (await contact.name()) // 发消息人昵称
  const remarkName = await contact.alias() // 备注名称
  const name = await contact.name() // 微信名称
  const isText = msg.type() === bot.Message.Type.Text // 消息类型是否为文本
  const isRoom = roomName && content.includes(`${botName}`) // 是否在群聊内并且艾特了机器人
  const isBotSelf = botName === remarkName || botName === name // 是否是机器人自己

  // 如果是机器人自己发送的消息或者消息类型不是文本则不处理
  if (isBotSelf || !isText){
    return
  }

  try {
    const question = await msg.mentionText() || content.replace(`${botName}`, '') // 去掉艾特的消息主体
    console.log('🌸🌸🌸 / question: ', question)
    const response = await staticReply(getReply, name, question)
    console.log(`got response ${response}`)
    if (response === '') {
      return
    }
    // 区分群聊和私聊
    if (isRoom && room) {
      await room.say(response)
    }
    // 私人聊天，白名单内的直接发送
    if (!room) {
      await contact.say(response)
    }
  } catch (e) {
    console.error(e)
  }

}

/**
 * 分片消息发送
 * @param message
 * @param bot
 * @returns {Promise<void>}
 */
export async function shardingMessage(message, bot) {
  const talker = message.talker()
  const isText = message.type() === bot.Message.Type.Text // 消息类型是否为文本
  if (talker.self() || message.type() > 10 || (talker.name() === '微信团队' && isText)) {
    return
  }
  const text = message.text()
  const room = message.room()
  if (!room) {
    console.log(`Chat GPT Enabled User: ${talker.name()}`)
    const response = await getChatGPTReply(text)
    await trySay(talker, response)
    return
  }
  let realText = splitMessage(text)
  // 如果是群聊但不是指定艾特人那么就不进行发送消息
  if (text.indexOf(`${botName}`) === -1) {
    return
  }
  realText = text.replace(`${botName}`, '')
  const topic = await room.topic()
  const response = await getChatGPTReply(realText)
  const result = `${realText}\n ---------------- \n ${response}`
  await trySay(room, result)
}

async function staticReply(aiReply, name, question) {
  if (question === '抽签' || question === '阿邦抽签'){
    const qian = Chouqian()
    const question = `你是一个精通中国传统抽签算命文化的学者，我抽中的签是 ${qian} , 请为我解读一番, 控制在40字以内`
    var response = ''
    try{
      response = await aiReply(question)
    } catch(eirror) {
      response = '获取解读失败'
    }
    const reply = `恭喜 @${name} 抽中\n\n${qian}\n\nAI解读如下\n${response}`
    return reply
  }
  return ''
}

// 分片长度
const SINGLE_MESSAGE_MAX_SIZE = 500

/**
 * 发送
 * @param talker 发送哪个  room为群聊类 text为单人
 * @param msg
 * @returns {Promise<void>}
 */
async function trySay(talker, msg) {
  const messages = []
  let message = msg
  while (message.length > SINGLE_MESSAGE_MAX_SIZE) {
    messages.push(message.slice(0, SINGLE_MESSAGE_MAX_SIZE))
    message = message.slice(SINGLE_MESSAGE_MAX_SIZE)
  }
  messages.push(message)
  for (const msg of messages) {
    await talker.say(msg)
  }
}

/**
 * 分组消息
 * @param text
 * @returns {Promise<*>}
 */
async function splitMessage(text) {
  let realText = text
  const item = text.split('- - - - - - - - - - - - - - -')
  if (item.length > 1) {
    realText = item[item.length - 1]
  }
  return realText
}
