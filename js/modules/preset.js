"use strict";
import { _ } from "./util.js";
import { readFile } from "./read-write.js";
import { Param } from "./param.js";

export { getPresetKeys, getPresetConfig };

let presetConfig = {};
async function getPresetKeys(preset) {
  if (!preset) return { error: `Preset not found` };

  const { result, error } = await readFile(`./jsons/${preset}.json`); //await response.json()
  if (error) return { error: `Preset ${preset} not found` };

  Object.assign(presetConfig, result);
  const keys = Object.keys(presetConfig);
  return { keys };
}

function getPresetConfig(type) {
  if (!type) return { error: `Preset Config: "type" missing` };

  const config = presetConfig[type];
  if (!config) return { error: `Preset Config: "config" missing for: "${type}"` };

  const { files, reportDate, covertDatesToToday } = config;
  if (!files) return { error: `Preset Config: "file" missing for: "${type}"` };

  let daysToAdd = 0;

  if (covertDatesToToday) {
    if (!reportDate) return { error: `Preset Config: "report dae" missing for: "${type}"` };
    if (!_.isValidDate(reportDate))
      return { error: `Preset Config: invalid "report date" for: "${type}"` };

    const today = new Date().toISOString().substring(0, 10);
    daysToAdd = _.dateTimeDiff(reportDate, today, "Days");
  }
  config.presetOffsetDays = daysToAdd;
  
  const json = replaceDates(JSON.stringify(config), daysToAdd);
  try {
    const config = JSON.parse(json);
    return { config };
  } catch (e) {
    const msg = `Preset Config: pasre failed; json: ${json}, type: ${type}, error: ${e.message}`;
    // $l.log(msg, "Error")
    // console.log(msg);
    return { error: msg };
  }

  function replaceDates(str, daysToAdd) {
    if (daysToAdd === 0) return str;

    //to do add more date conversion for any valid date
    const datePatterns = [
      "(19|20)[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])", // yyyy-mm-dd
      // "[0-9]{4}-[0-9]{2}-[0-9]{2}"
    ];

    let dateReplacedStr = str;
    for (const pattern of datePatterns) {
      const regExp = new RegExp(pattern, "gi");
      dateReplacedStr = dateReplacedStr.replace(regExp, (date) =>
        _.addDays(date, daysToAdd)
      );
    }
    return dateReplacedStr;
  }
}
