
var assert = require('assert');
const { TiledeskChatbot } = require('../models/TiledeskChatbot_Intents_Adapter.js');
const { MockBotsDataSource } = require('../models/MockBotsDataSource.js');

const testBots = {
  "bots": {
    "bot1": {
      "webhook_enabled": false,
      "_id": 'bot1',
      "name": 'test bot',
      "id_project": 'project1',
      "intents": {
        "intent1": {
          intent_display_name: "intent1",
          questions: [
            "intent1 question1",
            "intent1 question2"
          ],
          answer: "reply to intent1"
        },
        "intent2": {
          intent_display_name: "intent1",
          questions: [
            "intent2 question1",
            "intent2 question2"
          ],
          answer: "reply to intent2"
        },
        "intent3": {
          intent_display_name: "intent3",
          questions: [
            "intent3 question1",
            "intent3 question2"
          ],
          answer: "reply to intent3"
        }
      },
      "questions_intent": {
      
        "intent1 question1": "intent1",
        "intent1 question2": "intent1",
        
        "intent2 question1": "intent2",
        "intent2 question2": "intent2",
      
        "intent3 question1": "intent3",
        "intent3 question2": "intent3"
      },
      "intents_nlp" : {
        "query1": {
          "name": "intent1"
        },
        "query2": {
          "name": "intent2"
        }
      }
    }
  }
}

describe('Basic replyToMessage()', function() {
  it('create TiledeskChatbot instance', () => {
      const chatbot = new TiledeskChatbot({
        botsDataSource: {},
        intentsFinder: {},
        botId: "bot1",
        token: "token",
        APIURL: "APIURL",
        APIKEY: "___",
        tdcache: null,
        requestId: "request1",
        projectId: "project1",
        log: false
    });
    assert(chatbot != null);
  });

  it('query intent action', async () => {
    const dataSource = new MockBotsDataSource(testBots);
    const botId = "bot1";
    const chatbot = new TiledeskChatbot({
      botsDataSource: dataSource,
      intentsFinder: dataSource,
      botId: botId,
      token: "token",
      APIURL: "APIURL",
      APIKEY: "___",
      tdcache: null,
      requestId: "requestId",
      projectId: "projectId",
      log: false
    });
    assert(chatbot != null);
    const message = {
      text: "not important",
      attributes: {
          action: "intent1"
      },
      request: {
          request_id: "requestId"
      }
    }
    const reply = await chatbot.replyToMessage(message);
    assert(reply);
    assert(reply.text === testBots.bots[botId].intents.intent1.answer);
  });

  it('query exact match', async () => {
    const dataSource = new MockBotsDataSource(testBots);
    const botId = "bot1";
    const chatbot = new TiledeskChatbot({
      botsDataSource: dataSource,
      intentsFinder: dataSource,
      botId: botId,
      token: "token",
      APIURL: "APIURL",
      APIKEY: "___",
      tdcache: null,
      requestId: "requestId",
      projectId: "projectId",
      log: false
    });
    assert(chatbot != null);
    const message = {
      text: "intent1 question1",
      request: {
          request_id: "requestId"
      }
    }
    const reply = await chatbot.replyToMessage(message);
    assert(reply);
    assert(reply.text === testIntents.intents.intent1.answer);
    assert(reply.attributes.intent_info.intent_name === testBots.bots[botId].intents.intent1.intent_display_name);
  });

  it('query NLP', async () => {
    const dataSource = new MockBotsDataSource(testBots);
    const botId = "bot1";
    const chatbot = new TiledeskChatbot({
      botsDataSource: dataSource,
      intentsFinder: dataSource,
      botId: botId,
      token: "token",
      APIURL: "APIURL",
      APIKEY: "___",
      tdcache: null,
      requestId: "requestId",
      projectId: "projectId",
      log: false
    });
    assert(chatbot != null);
    const message = {
      text: "query1",
      request: {
          request_id: "requestId"
      }
    }
    const reply = await chatbot.replyToMessage(message);
    assert(reply);
    assert(reply.text === testIntents.intents.intent1.answer);
    assert(reply.attributes.intent_info.intent_name === testBots.bots[botId].intent1.intent_display_name);
  });

  it('query with defaultFallback', async () => {
    // clone and add defaultFallback
    let testIntents_with_defaultFallback = JSON.parse(JSON.stringify(testBots));
    // This doesn't work. Objects are copied by reference. Only first level properties are cloned.
    //let testIntentsDataSource_with_defaultFallback = Object.assign({}, testIntentsDataSource);
    // added defaultFallback intent
    const botId = "bot1";
    testIntents_with_defaultFallback.bots[botId].intents["defaultFallback"] = {
      intent_display_name: "defaultFallback",
      questions: [
        "defaultFallback question1",
        "defaultFallback question2"
      ],
      answer: "reply to defaultFallback"
    }
    const dataSource = new MockBotsDataSource(testBots, testIntents_with_defaultFallback);
    const chatbot = new TiledeskChatbot({
      botsDataSource: dataSource,
      intentsFinder: dataSource,
      botId: botId,
      token: "token",
      APIURL: "APIURL",
      APIKEY: "___",
      tdcache: null,
      requestId: "requestId",
      projectId: "projectId",
      log: false
    });
    assert(chatbot != null);
    const message = {
      text: "query unknown",
      request: {
          request_id: "requestId"
      }
    }
    const reply = await chatbot.replyToMessage(message);
    assert(reply);
    assert(reply.text === testIntents_with_defaultFallback.intents["defaultFallback"].answer);
  });

  it('query with missing defaultFallback', async () => {
    const dataSource = new MockBotsDataSource(testBots);
    const chatbot = new TiledeskChatbot({
      botsDataSource: dataSource,
      intentsFinder: dataSource,
      botId: "bot1",
      token: "token",
      APIURL: "APIURL",
      APIKEY: "___",
      tdcache: null,
      requestId: "requestId",
      projectId: "projectId",
      log: false
    });
    assert(chatbot != null);
    const message = {
      text: "query unknown",
      request: {
          request_id: "requestId"
      }
    }
    const reply = await chatbot.replyToMessage(message);
    assert(reply == null);
  });

});



