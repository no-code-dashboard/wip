"use strict";
import { Param } from "./modules/param.js";
import { Counter } from "./modules/counter.js";
import {
  _,
  saveCounts,
  getCounts,
  setItem,
  getItem,
  getChartId,
  getChartContainer,
  getKey,
  clearCounts,
} from "./modules/util.js";

import { getPresetKeys, getPresetConfig } from "./modules/preset.js";
import { Logger } from "./modules/logger.js";
import {
  drawChart,
  createCallout,
  destroyAllCharts,
  amimateChart,
} from "./modules/chart.js";
import {
  showLayoutDialog,
  showChartMenus,
  configChart, //do we need this?
  showCalloutMenu,
  showLoadFileDialog,
} from "./modules/dialog-use.js";
import { Dialog } from "./modules/dialog.js";
// import { readFile } from "./modules/readwrite.js";

import { smokeTest } from "./modules/smoke-test.js";
import { registerComponents } from "./modules/web-comp.js";

window.addEventListener("load", (event) => {
  registerComponents();
  addMenuListeners();
  const url = new URL(window.location.toLocaleString());
  const search = url.search;
  if (!search) {
    showInitialChoice({ url, loadNewData });
    return;
  }
  const preset = search.replace("?", "").trim();
  createPresetMenus(preset);
  async function createPresetMenus(preset) {
    const presetDiv = _.select("#top-nav #preset");
    const notPresetDiv = _.select("#top-nav #not-preset");
    const tocClone = _.selectAll("button", notPresetDiv)[0];

    const { keys, error } = await getPresetKeys(preset);

    if (error) {
      Dialog.alert(error);
      return;
    }
    keys.forEach((label, i) => {
      const clone = tocClone.cloneNode(true);
      clone.textContent = label;
      clone.id = "preset-" + i;
      clone.addEventListener("click", () => loadPresetFile(label));
      presetDiv.appendChild(clone);
    });
    notPresetDiv.style.display = "none";
    adjustMenusDisplay(["show-toc", "print"], "");
    _.selectAll("#top-nav #preset .menu")[0].click();
  }
});
window.addEventListener("click", (e) => {
  const id = e.target.id;
  // console.log(e.target.parentElement)
  if (id && id.startsWith("chart-")) {
    selectDiv("#" + id);
  }
});
function addMenuListeners() {
  const menus = _.selectAll(".menu");
  for (const m of menus) {
    const id = m.id;
    m.tabindex = 0;
    m.addEventListener("click", () => menu(id));
  }
}
function adjustMenusDisplay(ids = [], display = "") {
  ids.forEach((id) => (_.select("#" + id).style.display = display));
}

// window.addEventListener("scroll", (e) => {
//   const goToTop = _.select("#go-to-top");
//   const docEl = document.documentElement;
//   const pos = docEl.scrollTop;
//   const lastScrollTop = getItem("scroll-top") ?? pos;
//   setItem("scroll-top", pos);
//   if (lastScrollTop < pos) {
//     goToTop.style.display = "none";
//     return;
//   }
//   const h = docEl.scrollHeight - docEl.clientHeight;
//   const scrollValue = Math.round((pos * 100) / h);

//   if (scrollValue < 20) goToTop.style.display = "none";
//   else {
//     goToTop.style.display = "grid";
//     goToTop.setAttribute("data-value", scrollValue);
//   }

//   // console.log(scrollValue)
// });

function setLoader(action) {
  const progress = _.select("#loader-wrapper progress");
  progress.style.visibility = action === "show-progress" ? "visible" : "hidden";
  const show = action === "show" || action === "show-progress";
  const main = _.select("main");
  main.style.visibility = show ? "hidden" : "visible";

  const loader = _.select("#loader-wrapper");
  loader.style.display = show ? "block" : "none";
}

function readyDashboard() {
  _.clearHTML("#data-source");
  _.clearHTML("#log");
  const reportTitles = _.select("#report-titles");
  _.select("h1", reportTitles).textContent = "";
  _.select("h2", reportTitles).textContent = "";
  clearCounts();
  destroyAllCharts();
  // _.sleep(1000);
}

async function loadPresetFile(presetType) {
  setLoader("show-progress");
  hideDropdown();
  readyDashboard();
  const cause = "handled error";
  try {
    if (!presetType) throw new Error(`presetType absent`, { cause });
    highlightPresetMenu(presetType);
    const { config, error } = getPresetConfig(presetType);
    if (error) throw new Error(error, { cause });
    const { files } = config;
    if (!(await _.isValidFile(files[0])))
      throw new Error(`Invalid file: ${files[0]}`, { cause });
    Param.setParam("config", { newConfig: config, replace: true });
    updateDataSource([files[0]]);
    await countNow();
  } catch (error) {
    if (error.cause !== cause) console.error("unexpected", error);
    Logger.logValues(error.message, "error");
    Logger.showLogs();
    setLoader("hide");
  }
}

async function loadNewData(blob, filename) {
  Logger.clearLogs();
  const config = Param.getParam("config");
  const action = _.isEmptyObject(config)
    ? "Reset Config"
    : await actionOnConfig();
  if (action === "Abort Load") return;
  setLoader("show-progress");
  readyDashboard();
  if (action === "Reset Config") {
    const dataDescription = await Counter.getCountsFromFile(
      _.stringify({ blob })
    );
    console.log(dataDescription);
    Param.setParam("config", { file: blob, dataDescription });
  }
  if (action === "Keep Config") Param.setParam("config", { file: blob });
  updateDataSource([blob], [filename]);
  await countNow();

  adjustMenusDisplay(["show-toc", "print"], "");
  setLoader("hide");
  async function actionOnConfig() {
    //to do get first row and compare
    const areHeadersSame = false;
    if (areHeadersSame) return "Keep Config";
    return await Dialog.alert(`Config present`, [
      "Keep Config",
      "Reset Config",
      "Abort Load",
    ]);
    return action;
  }
}
async function showInitialChoice({ url, loadNewData }) {
  //to do get first row and compare
  const response = await Dialog.alert(
    ``,
    ["Load data", "Show demo", "Cancel"],
    "Select to proceed"
  );
  if (response == "Show demo") {
    window.open("index.html?demo", "_self");
  }
  if (response == "Load data") {
    showLoadFileDialog({
      header: "Load data file",
      extention: ".csv",
      loadFunction: loadNewData,
    });
  }
  return;
}
async function countNow(filter) {
  Logger.startLogs();
  const config = Param.getParam("config");
  const json = JSON.stringify({ filter, config });
  const allCounts = await Counter.getCountsFromFile(json);

  saveCounts(allCounts);
  showCharts();
  showFilters();
  Logger.showLogs();
  setLoader("hide");
}

function createTag(text, colorClass, tooltip) {
  return _.createElements({
    span: { class: colorClass, text, "data-title": tooltip },
  });
}

// const hasFilter = (chartId) => {
// }

function showFilters() {
  const allCounts = getCounts();
  if (!allCounts.memo.global) return;
  const { totalRowCounts, filteredRowCounts } = allCounts.memo.global;

  const label =
    filteredRowCounts != totalRowCounts
      ? `${filteredRowCounts} out of ${totalRowCounts} rows of data shown`
      : `All ${totalRowCounts} rows of data shown`;

  Logger.logValues(label, "info");
  // filterValueDiv.appendChild(createTag(label, "tag-info"));

  for (const [key, value] of Object.entries(allCounts.counts)) {
    const excluded = [],
      included = [];

    for (const [k, v] of Object.entries(allCounts.counts[key])) {
      v.include ? included.push(k) : excluded.push(k);
    }

    if (excluded.length > 0) {
      const isMember = "=",
        isNotMember = "\u2260";
      let filterValue = "Filter";
      // Param.getParam("chart-properties", key).chartTitleWithIndex + " ";
      if (included.length <= excluded.length)
        filterValue += isMember + " [" + included.join(", ") + "] ";
      else filterValue += isNotMember + " [" + excluded.join(", ") + "] ";

      // filterValueDiv.appendChild(createTag(filterValue, "tag-info"));
      Logger.logValues(filterValue, "info", key);
    }
  }
}

function showCharts() {
  const mainTitle = _.select("#main-title");
  const { reportDate, reportTitle, reportSubtitle } = Param.getParam("config");
  mainTitle.textContent = reportTitle;
  const subTitle = _.select("#sub-title");
  subTitle.textContent =
    reportSubtitle ??
    "Data as of: " + _.formatDate(reportDate, "DDD DD-MMM-YYYY");

  const callOutWrapper = _.clearHTML(".callout-container");
  const wrapper = _.clearHTML(".chart-container");
  const toc = _.clearHTML("#toc");
  const dropdownTOC = _.clearHTML("#dropdown-toc");
  dropdownTOC.addEventListener("click", () => toggleDropdown());
  const allCounts = getCounts();

  for (const key in allCounts.callouts) {
    const div = _.createElements(
      `<div class="callout" id="callout-${key}">
        <div id="top"></div>
        <div class="line"></div>
        <button id="bottom"></button>
      </div>`
    );

    const button = _.select("#bottom", div);
    button.addEventListener("click", () => {
      selectDiv(`#callout-${key}`);
      showCalloutMenu(key, reCreateCharts, scrollToChart);
    });

    callOutWrapper.append(div);
    createCallout(key, allCounts.callouts[key], scrollToChart);
  }

  for (const key in allCounts.counts) {
    const { chartType, chartTitleWithIndex, chartSize } = Param.getParam(
      "chart-properties",
      key,
      true
    );
    const spanClass = "" + chartSize.toLowerCase();

    const id = getChartId(key);
    // const chartTemplate = _.select("#wrapper-loader .chart");
    const chartTemplate = _.select("#chart-template");
    createChartPlaceholder();
    createTOCentry();

    const data = allCounts.data[key];
    // const memo = allCounts.memo[key]
    drawChart(id, data, chartClick);

    function createChartPlaceholder() {
      const containerId = getChartContainer(key);
      const div = _.createElements(`
      <div class="surface-1 chart ${spanClass}" data-chart-type="${chartType}" id="${containerId}">
        <h4>
          <span>${chartTitleWithIndex}</span>
          <button tabindex="0">&#8942;</button>
        </h4>
        <div id="chart-${key}"></div>
        <div class="tags"></div>
        <div class="chart-footer"></div>
      </div>`);

      _.select("button", div).addEventListener("click", () => {
        selectDiv(`#${containerId}`);
        showChartMenus(id, reCreateCharts, showCharts);
      });
      wrapper.appendChild(div);
    }

    function createTOCentry() {
      const a = {
        a: {
          href: "#" + getChartContainer(key),
          text: chartTitleWithIndex,
        },
      };

      const tocEntry = _.createElements({ div: a });
      toc.appendChild(tocEntry);
      const tocEntryDup = _.createElements(a);

      dropdownTOC.appendChild(tocEntryDup);
      // dropdownTOC.setAttribute("onclick", "toggleDropdown()");
    }
  }
}

async function chartClick(chartId, category) {
  selectDiv("#chart-container" + chartId.replace("chart", ""));
  if (!category) return;
  const allCounts = getCounts();
  const key = getKey(chartId);

  const oneCount = allCounts.counts[key];
  for (const [k, v] of Object.entries(oneCount))
    if (k !== category) v.include = !v.include;

  await countNow(allCounts);
  selectDiv("#chart-container" + chartId.replace("chart", ""));
}
async function chartResetFilter(chartId) {
  let allCounts = getCounts();
  const key = getKey(chartId);
  const oneCount = allCounts[key].counts;

  for (const [k, v] of Object.entries(oneCount)) v.include = true;
  await countNow(allCounts);
}

function menu(action) {

  if (action === "show-toc") {
    toggleDropdown();
    return;
  }
  
  hideDropdown();
  if (action === "print") {
    //adjust toc for print
    window.print();
    //adjust toc for sceen
    return;
  }

  if (action === "load-data") {
    showLoadFileDialog({
      header: "Load data file",
      extention: ".csv",
      loadFunction: loadNewData,
    });
    return;
  }
  if (action == "upload-config") {
    function loadConfig(file) {
      fetch(file)
        .then((response) => {
          if (!response.ok) {
            Dialog.alert("Network response was not ok");
          }
          return response.json();
        })
        .then((data) => {
          // 'data' is the JavaScript object from the JSON file
          console.log(data);
          Param.setParam("config", { config: data, replace: true });
          // You can now use the data to update your page
          // For example: document.getElementById('my-element').textContent = data.message;
        })
        .catch((error) => {
          Dialog.alert("There was a problem with the fetch operation:", error);
        });
    }
    showLoadFileDialog({
      header: "Load config file",
      extention: ".json",
      loadFunction: loadConfig,
    });
    return;
  }
  if (action == "download-config") {
    const config = Param.getParam("config");
    const json = JSON.stringify(config, null, 2);
    if (json == "{}") return;
    navigator.clipboard.writeText(json);
    downloadFile(json, "config.json");
    return;
  }
  if (action == "configure-dashboard") return showLayoutDialog(reCreateCharts);

  if (action == "showData") {
    return;
  }

  if (action === "smoke-test") {
    smokeTest(loadPresetFile, scrollToChart, configChart);
    return;
  }

  const error = `"${action}" not implemented`;
  // console.error(error)
  Dialog.alert(error);
}

function updateDataSource(sources, names) {
  const dataSource = _.clearHTML("#data-source");
  dataSource.appendChild(createTag(`Data source`, "tag-info"));

  sources.forEach((source, i) => {
    const a = _.createElements({
      span: {
        a: {
          href: source,
          target: "_blank",
          text: names?.[i] ?? filename(source),
          "data-title": "Click to view/download the file",
        },
        class: "tag-info",
      },
    });
    dataSource.appendChild(a);
  });
  function filename(name) {
    if (!name.endsWith(".csv")) return name;
    const regex = /\/([^\/]+)$/;
    const match = name.match(regex);
    if (match && match.length > 1) return match[1];
    return name;
  }
}
///////////////////////////menu bar functions
function hideDropdown() {
  const dropdownTOC = _.select("#dropdown-toc");
  dropdownTOC.style.display = "none";
}
function toggleDropdown() {
  const dropdownTOC = _.select("#dropdown-toc");
  const tocIsHidden =
    dropdownTOC.style.display === "" || dropdownTOC.style.display === "none";
  if (tocIsHidden) dropdownTOC.style.display = "block";
  else dropdownTOC.style.display = "none";
  // toc.classList.toggle("only-print");
}
function highlightPresetMenu(label) {
  //     const presetAList = document
  //         .querySelector("#top-nav")
  //         .querySelector("#preset")
  //         .querySelectorAll("a")
  //     for (let i = 0; i < presetAList.length; i++) {
  //         const a = presetAList[i]
  //         a.classList.remove("focus")
  //         if (a.textContent === label) a.classList.add("focus")
  //     }
}

async function reCreateCharts(key, removeFilter = false) {
  // const scrollY = window.scrollY;
  const filter = removeFilter ? undefined : getCounts();
  destroyAllCharts();
  await countNow(filter);
  // window.scroll(0, scrollY);
  scrollToChart(key);
}

function scrollToChart(key) {
  if (!key) return;
  console.log(key);
  const chart = _.select(`#${getChartContainer(key)}`);
  if (!chart) return;
  chart.scrollIntoView(false);
  selectDiv(`#${getChartContainer(key)}`);
}

function selectDiv(selector) {
  const divs = _.selectAll(".selected");
  divs.forEach((div) => {
    div.classList.remove("selected");
  });

  const div = _.select(selector);
  if (!div) return;
  amimateChart(selector, "bar");
  console.log(selector);
  div.classList.add("selected", "flash-border");
  _.sleep(1500).then(() => {
    div.classList.remove("flash-border");
  });
}
/* 
mvp
bug - table showing more that 10 (done: was a bug for new files)
bug - config bar not updating current values (done)

fix tag: table and tag: objcet - to do button highlights

fix callout
add donut to call out
read 2000 record limit on new file
change language for the demo, help text

*/
