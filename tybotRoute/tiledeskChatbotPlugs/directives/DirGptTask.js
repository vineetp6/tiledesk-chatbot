const axios = require("axios").default;
const { TiledeskChatbot } = require("../../models/TiledeskChatbot");
const { Filler } = require("../Filler");
let https = require("https");
const { DirIntent } = require("./DirIntent");
require('dotenv').config();

class DirGptTask {

  constructor(context) {
    if (!context) {
      throw new Error('context object is mandatory');
    }
    this.context = context;
    this.tdcache = this.context.tdcache;
    this.requestId = this.context.requestId;
    this.intentDir = new DirIntent(context);
    this.log = context.log;
  }

  execute(directive, callback) {
    if (this.log) { console.log("GptTask directive: ", directive); }
    let action;
    if (directive.action) {
      action = directive.action;
    }
    else {
      console.error("Incorrect directive: ", JSON.stringify(directive));
      callback();
      return;
    }
    this.go(action, (stop) => {
      callback(stop);
    })
  }

  async go(action, callback) {
    if (this.log) { console.log("DirGptTask action:", JSON.stringify(action)); }
    if (!this.tdcache) {
      console.error("Error: DirGptTask tdcache is mandatory");
      callback();
      return;
    }

    let trueIntent = action.trueIntent;
    let falseIntent = action.falseIntent;
    let trueIntentAttributes = action.trueIntentAttributes;
    let falseIntentAttributes = action.falseIntentAttributes;

    if (this.log) {
      console.log("DirAskGPT trueIntent", trueIntent)
      console.log("DirAskGPT falseIntent", falseIntent)
      console.log("DirAskGPT trueIntentAttributes", trueIntentAttributes)
      console.log("DirAskGPT falseIntentAttributes", falseIntentAttributes)
    }

    // default value
    let answer = "No answer.";

    if (!action.question || action.question === '') {
      console.error("Error: DirGptTask question attribute is mandatory. Executing condition false...")
      if (falseIntent) {
        await this.#executeCondition(false, trueIntent, trueIntentAttributes, falseIntent, falseIntentAttributes);
        callback(true);
        return;
      }
      callback();
      return;
    }

    let requestVariables = null;
    requestVariables =
      await TiledeskChatbot.allParametersStatic(
        this.tdcache, this.requestId
      )

    const filler = new Filler();
    const filled_question = filler.fill(action.question, requestVariables);

    let max_tokens = action.max_tokens;
    let temperature = action.temperature;

    if (this.log) {
      console.log("DirGptTask max_tokens: ", max_tokens);
      console.log("DirGptTask temperature: ", temperature);
    }

    const server_base_url = process.env.API_ENDPOINT || process.env.API_URL;
    const openai_url = process.env.OPENAI_ENDPOINT + "/chat/completions";
    if (this.log) {
      console.log("DirGptTask server_base_url ", server_base_url);
      console.log("DirGptTask openai_url ", openai_url);
    }

    const INTEGRATIONS_HTTPREQUEST = {
      url: server_base_url + "/" + this.context.projectId + "/integration/name/openai",
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'JWT ' + this.context.token
      },
      method: "GET"
    }
    if (this.log) { console.log("DirGptTask INTEGRATIONS_HTTPREQUEST ", INTEGRATIONS_HTTPREQUEST) }

    this.#myrequest(
      INTEGRATIONS_HTTPREQUEST, async (err, integration) => {
        if (err) {
          if (callback) {
            console.error("(httprequest) DirGptTask get integrations err:", err);
            // Don't stop the flow here. Try aniway to retrieve the key from KBs
            // callback();
            // return;
          }
        } else if (callback) {
          if (this.log) { console.log("DirGptTask get integration resbody: ", integration); }

          let key;
          if (integration &&
            integration.value) {
            key = integration.value.apikey;
          }

          // key not present in integrations - for retro compatibility search in kbsettings
          if (!key) {

            // if (this.log) { console.log("DirGptTask - Key not found in Integrations. Searching in kb settings...")}
            if (this.log) { console.log("DirGptTask - Key not found in Integrations. Searching in kb settings..."); }

            const KB_HTTPREQUEST = {
              url: server_base_url + "/" + this.context.projectId + "/kbsettings",
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'JWT ' + this.context.token
              },
              method: "GET"
            }
            if (this.log) { console.log("DirGptTask KB_HTTPREQUEST", KB_HTTPREQUEST); }

            this.#myrequest(
              KB_HTTPREQUEST, async (err, resbody) => {
                if (err) {
                  if (callback) {
                    console.error("(httprequest) DirGptTask Get KnowledgeBase err:", err);
                    await this.#assignAttributes(action, answer);
                    if (falseIntent) {
                      await this.#executeCondition(false, trueIntent, trueIntentAttributes, falseIntent, falseIntentAttributes);
                      callback(true);
                      return;
                    }
                    callback();
                    return;
                  }
                } else if (callback) {
                  if (this.log) { console.log("DirGptTask Get KnowledgeBase settings resbody:", resbody); }

                  if (!resbody.gptkey) {
                    await this.#assignAttributes(action, answer);
                    if (falseIntent) {
                      await this.#executeCondition(false, trueIntent, trueIntentAttributes, falseIntent, falseIntentAttributes);
                      callback(true);
                      return;
                    }
                    callback();
                    return;

                  } else {

                    if (this.log) { console.log("DirGptTask - Key found in KbSettings") };

                    key = resbody.gptkey;

                    let json = {
                      "model": action.model,
                      "messages": [
                        {
                          "role": "user",
                          "content": filled_question
                        }
                      ],
                      "max_tokens": action.max_tokens,
                      "temperature": action.temperature
                    }

                    let message = { role: "", content: "" };
                    if (action.context) {
                      message.role = "system";
                      message.content = action.context;
                      json.messages.unshift(message);
                    }
                    if (this.log) { console.log("DirGptTask json: ", json) }

                    const HTTPREQUEST = {
                      url: openai_url,
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + key
                      },
                      json: json,
                      method: 'POST'
                    }
                    if (this.log) { console.log("DirGptTask HTTPREQUEST: ", HTTPREQUEST); }
                    this.#myrequest(
                      HTTPREQUEST, async (err, resbody) => {
                        if (err) {
                          if (this.log) {
                            console.error("(httprequest) DirGptTask openai err:", err);
                            console.error("(httprequest) DirGptTask openai err:", err.response.data);
                          }
                          await this.#assignAttributes(action, answer);
                          if (falseIntent) {
                            await this.#executeCondition(false, trueIntent, trueIntentAttributes, falseIntent, falseIntentAttributes);
                            callback(true);
                            return;
                          }
                          callback();
                          return;
                        } else {
                          if (this.log) { console.log("DirGptTask resbody: ", JSON.stringify(resbody)); }
                          answer = resbody.choices[0].message.content;
                          await this.#assignAttributes(action, answer);
                          if (trueIntent) {
                            await this.#executeCondition(true, trueIntent, trueIntentAttributes, falseIntent, falseIntentAttributes);
                            callback(true);
                            return;
                          }
                          callback();
                          return;
                        }
                      }
                    )
                  }
                }
              }
            )
          } else {

            if (this.log) { console.log("DirGptTask - Key found in Integrations") };

            let json = {
              "model": action.model,
              "messages": [
                {
                  "role": "user",
                  "content": filled_question
                }
              ],
              "max_tokens": action.max_tokens,
              "temperature": action.temperature
            }

            let message = { role: "", content: "" };
            if (action.context) {
              message.role = "system";
              message.content = action.context;
              json.messages.unshift(message);
            }
            if (this.log) { console.log("DirGptTask json: ", json) }

            const HTTPREQUEST = {
              url: openai_url,
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + key
              },
              json: json,
              method: 'POST'
            }
            if (this.log) { console.log("DirGptTask HTTPREQUEST: ", HTTPREQUEST); }
            this.#myrequest(
              HTTPREQUEST, async (err, resbody) => {
                if (err) {
                  if (this.log) {
                    console.error("(httprequest) DirGptTask openai err:", err);
                    console.error("(httprequest) DirGptTask openai err:", err.response.data);
                  }
                  await this.#assignAttributes(action, answer);
                  if (falseIntent) {
                    await this.#executeCondition(false, trueIntent, trueIntentAttributes, falseIntent, falseIntentAttributes);
                    callback(true);
                    return;
                  }
                  callback();
                  return;
                } else {
                  if (this.log) { console.log("DirGptTask resbody: ", JSON.stringify(resbody)); }
                  answer = resbody.choices[0].message.content;
                  // check if answer is a json
                  let answer_json = await this.convertToJson(answer);
                  await this.#assignAttributes(action, answer_json);
                  if (trueIntent) {
                    await this.#executeCondition(true, trueIntent, trueIntentAttributes, falseIntent, falseIntentAttributes);
                    callback(true);
                    return;
                  }
                  callback();
                  return;
                }
              }
            )

          }
        }
      }
    )
  }

  async convertToJson(data) {

    return new Promise((resolve) => {
      let json = null;
      try {
        json = JSON.parse(data);
        resolve(json)
      } catch(err) {
        resolve(data)
      }
    })

  }

  async #executeCondition(result, trueIntent, trueIntentAttributes, falseIntent, falseIntentAttributes, callback) {
    let trueIntentDirective = null;
    if (trueIntent) {
      trueIntentDirective = DirIntent.intentDirectiveFor(trueIntent, trueIntentAttributes);
    }
    let falseIntentDirective = null;
    if (falseIntent) {
      falseIntentDirective = DirIntent.intentDirectiveFor(falseIntent, falseIntentAttributes);
    }
    if (result === true) {
      if (trueIntentDirective) {
        this.intentDir.execute(trueIntentDirective, () => {
          if (callback) {
            callback();
          }
        })
      }
      else {
        if (this.log) { console.log("No trueIntentDirective specified"); }
        if (callback) {
          callback();
        }
      }
    }
    else {
      if (falseIntentDirective) {
        this.intentDir.execute(falseIntentDirective, () => {
          if (callback) {
            callback();
          }
        });
      }
      else {
        if (this.log) { console.log("No falseIntentDirective specified"); }
        if (callback) {
          callback();
        }
      }
    }
  }

  async #assignAttributes(action, answer) {
    if (this.log) {
      console.log("assignAttributes action:", action)
      console.log("assignAttributes answer:", answer)
    }
    if (this.context.tdcache) {
      if (action.assignReplyTo && answer) {
        await TiledeskChatbot.addParameterStatic(this.context.tdcache, this.context.requestId, action.assignReplyTo, answer);
      }
      // if (action.assignSourceTo && source) {
      //   await TiledeskChatbot.addParameterStatic(this.context.tdcache, this.context.requestId, action.assignSourceTo, source);
      // }
      // Debug log
      if (this.log) {
        const all_parameters = await TiledeskChatbot.allParametersStatic(this.context.tdcache, this.context.requestId);
        for (const [key, value] of Object.entries(all_parameters)) {
          if (this.log) { console.log("(askgpt) request parameter:", key, "value:", value, "type:", typeof value) }
        }
      }
    }
  }

  #myrequest(options, callback) {
    if (this.log) {
      console.log("API URL:", options.url);
      console.log("** Options:", JSON.stringify(options));
    }
    let axios_options = {
      url: options.url,
      method: options.method,
      params: options.params,
      headers: options.headers
    }
    if (options.json !== null) {
      axios_options.data = options.json
    }
    if (this.log) {
      console.log("axios_options:", JSON.stringify(axios_options));
    }
    if (options.url.startsWith("https:")) {
      const httpsAgent = new https.Agent({
        rejectUnauthorized: false,
      });
      axios_options.httpsAgent = httpsAgent;
    }
    axios(axios_options)
      .then((res) => {
        if (this.log) {
          console.log("Response for url:", options.url);
          console.log("Response headers:\n", JSON.stringify(res.headers));
        }
        if (res && res.status == 200 && res.data) {
          if (callback) {
            callback(null, res.data);
          }
        }
        else {
          if (callback) {
            callback(new Error("Response status is not 200"), null);
          }
        }
      })
      .catch((error) => {
        // console.error("An error occurred:", JSON.stringify(error.data));
        if (callback) {
          callback(error, null);
        }
      });
  }
}

module.exports = { DirGptTask }