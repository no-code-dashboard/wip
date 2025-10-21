"use strict";
import { _, getCounts, getChartContainer } from "./util.js";
export { Logger };
//steps comment const $.. () {  and the last return {} & }
const Logger = (function () {
  "use strict";
  let startDateTime;
  const logRecord = {};

  function logValues(message, severity, key) {
    logRecord[message] = [severity, key];
  }

  function clearLogs() {
    for (const key in logRecord) {
      delete logRecord[key];
    }
  }
  function startLogs() {
    clearLogs();
    startDateTime = new Date();
  }
  function showLogs() {
    const allCounts = getCounts();
    function resetChartLogs() {
      const counts = allCounts.counts;
      for (const key in counts) {
        const chartContainerId = getChartContainer(key);
        _.clearHTML(`#${chartContainerId} .tags`);
      }
    }
    function addP(message, severity, chartNo) {
      const messageClass = "tag-" + severity.toLowerCase();
      const span = _.createElements({
        span: { class: messageClass, text: message },
      });
      const chartContainerId = getChartContainer(chartNo);
      const msg = _.select(`#${chartContainerId} .tags`);
      (msg ? msg : logDiv).appendChild(span);
    }
    function getTimeToPrepareReport() {
      const end = new Date();
      const ms = _.dateTimeDiff(startDateTime, end, "Milliseconds");
      return `Time taken to make charts: ${ms / 1000} seconds`;
    }
    const logDiv = _.clearHTML("#log");
    if (!logDiv) {
      console.error("Log div not found", logRecord);
      return;
    }
    resetChartLogs();
    const memo = allCounts.memo;

    for (const item in memo) {
      const log = memo[item].log;
      if (!log) continue;
      for (const key in log) {
        const message = `${key} (${log[key].count}, ${log[key].first}-${log[key].last})`;
        addP(message, log[key].severity, item);
      }
    }
    // console.log(logRecord);
    for (const log in logRecord) {
      // console.log(log);
      const [severity, key] = logRecord[log];
      addP(log, severity, key);
    }

    addP(getTimeToPrepareReport(), "info");
  }
  return {
    clearLogs,
    logValues, //setLog
    startLogs, //startLog
    showLogs,
  };
})();
