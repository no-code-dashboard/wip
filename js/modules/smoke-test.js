"use strict";
import { _ } from "./util.js";
import { getPresetKeys, getPresetConfig } from "./preset.js";
import { Dialog } from "./dialog.js";
import { Param } from "./param.js";
// import { configChart } from "./dialoguse.js";

export { smokeTest };

let testType = ["charts", "configs"]; //"configs", "charts" , "callouts", "quick"
let duration = testType.includes("quick") ? 300 : 700;
async function smokeTest(loadPresetFile, scrollToChart, configChart) {
  const startSmoke = new Date();
  console.clear();
  const elements = [{ tag: "h2", label: "Smoke test results" }, { tag: "hr" }];
  await testCharts();
  record();
  await testConfigDialogs();
  record();
  record(
    `Smoke test done(testtype = ${testType.join(", ")}): ${elapsedTime(
      startSmoke
    )} s`
  );
  elements.push({ tag: "hr" }, { tag: "button", label: "Close" });
  Dialog.make(elements, { callback, classes: "dialog" }).show();

  function callback({ type, target }) {
    if (type === "click-button") Dialog.close();
  }

  async function testCharts() {
    const { keys } = await getPresetKeys("demo");
    const main = document.querySelector("main");
    // const savesStyle = body.style
    // body.style.scrollBehavior = "smooth"
    for (const key of keys) {
      const startLap = new Date();
      const presetType = key;
      await loadPresetFile(presetType);
      await scrollToEndAndBack(_.select("nav"), _.select("footer")); //_.select("body"));
      // await _.sleep(duration);
      const numberOfCharts = Param.getParam("chart-count");
      if (false && numberOfCharts) {
        //select random chart
        const randomChart = SelectRandomChart();
        // console.log(randomChart);
        for (let j = 0; j < numberOfCharts; j++) {
          scrollToChart(j);
          await _.sleep(duration);
          if (j === randomChart) {
            await _.sleep(duration);
            filterChart(j);
          }
        }
      }

      record(`Chart for ${presetType} done: ${elapsedTime(startLap)} s`);
      if (!testType.includes("charts")) break;
    }

    function SelectRandomChart() {
      const { chartProperties } = Param.getParam("config");
      if (!chartProperties) return -1;
      const chartCount = chartProperties.length;
      const firstBarChart = chartProperties.findIndex(
        (v) => v.chartType === "Bar"
      );

      if (firstBarChart === -1) return -1;
      let random = Math.floor(Math.random() * chartCount);
      while (chartProperties[random].chartType !== "Bar") {
        // console.log({ random, m: chartProperties.count })
        random++;
        if (random >= chartCount) random = 0;
      }
      return random;
    }
    function filterChart(key) {
      // const cats = getChartCategories(key);
      // const random = Math.floor(Math.random() * cats.length);
      // console.log({ key, cat: cats[random] });
      // chartClick(getChartId(key), cats[random]);
    }
  }
  async function testConfigDialogs() {
    if (!testType.includes("configs")) return;
    const numberOfCharts = Param.getParam("chart-count");
    for (let j = 0; j < numberOfCharts; j++) {
      const startLap = new Date();
      // scrollToChart(j);
      configChart("chart-" + j);
      await _.sleep(duration);
      // console.log(_.select("dialog"))
      const dialog = _.select("dialog");
      // console.log(dialog,dialog.open)
      const form = _.select("form", dialog);
      // const end = _.selectAll("button", dialog)
      await scrollToEndAndBack(form, form);

      // console.log(dialog.offsetHeight)
      // dialog.scrollBy({ top: 100000, behavior: "smooth" });
      // dialog.scrollTop = dialog.scrollHeight;
      // await _.sleep(duration);
      Dialog.close();
      record(`Config for chart ${j} done: ${elapsedTime(startLap)} s`);
    }
  }
  function elapsedTime(start) {
    const end = new Date();
    return Math.round(_.dateTimeDiff(start, end, "Milliseconds") / 1000);
  }
  function record(label) {
    if (!label) {
      elements.push({ tag: "hr" });
      console.log("-------------------------");
      return;
    }
    elements.push({ tag: "p", label });
    console.log(label);
  }
}

async function scrollToEndAndBack(start, end) {
  await _.sleep(duration);
  end.scrollIntoView({ behavior: "smooth", block: "end" });
  await _.sleep(duration);
  start.scrollIntoView({ block: "start", behavior: "smooth" });
  await _.sleep(duration);
}
import { chartTypes } from "./chart-types.js";
function validateObjects() {
  const invalids = {};
  for (const ct in chartTypes) {
    console.log(ct);
    const list = [
      "validateChart",
      "chartPlaceholders",
      "chartOverlay",
      "chartDefaults",
    ];
    list.forEach((l) => {
      if (!ct[l]) invalids[ct] = l;
    });
  }
  console.log({ invalids });
}
window.__dialogData = () => Dialog.data();
window.__config = () => Param.getParam("config");
window.__OK = () => validateObjects();
