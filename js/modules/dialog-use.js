"use strict";

/**
 * Todo
 * make element entries as x:{y:...} instead {tag: "x", y:...}
 * changes required in this module and in dialog.js
 */

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
} from "./util.js";
import { Dialog } from "./dialog.js";
import { Counter } from "./counter.js";
// import {} from "./common.js";
import { Param } from "./param.js";

import {
  chartTypes,
  noChart,
  validateChart,
  getCalloutOverlay,
  validateCallout,
} from "./chart-types.js";

export {
  showLayoutDialog,
  showChartMenus,
  showCalloutMenu,
  configChart,
  showLoadFileDialog,
};

const chartDescription = Counter.getChartDescription();

function getChartTypes() {
  return Object.keys(chartDescription).filter(
    (v) => chartDescription[v].isChart
  );
}
function cannotFilter(chartType) {
  if (!chartType) return false;
  if (!chartDescription[chartType]) return false;
  return chartDescription[chartType].cannotFilter;
}
function getChartsWithFilter() {
  const allCounts = getCounts();
  const counts = allCounts.counts;
  const filters = [];
  for (const key in counts) {
    let hasFilter = false;
    const isFalse = (v) => v !== undefined && !v;
    const count = counts[key];
    for (const cat in count) if (isFalse(count[cat].include)) hasFilter = true;
    if (hasFilter) filters.push(key);
  }
  return filters;
}
/////////////////////////////////////////////////////////////dshboard dialog
function showLayoutDialog(reCreateCharts) {
  const { reportTitle, reportDate, definedValues } = Param.getParam("config");
  const layoutDialog = [
    { tag: "h2", label: `Configure dashboard` },
    { tag: "hr" },
    { tag: "text", name: "reportTitle" },
    { tag: "date", name: "reportDate" },
    { tag: "hr" },
    { tag: "button", label: "Cancel" },
    { tag: "button", label: "Apply", class: "disable-on-error" },
  ];

  if (!reportDate) return;
  Dialog.make(layoutDialog, {
    callback,
    classes: "dialog medium",
    legend: "Config dashboard",
  }).show();
  function callback({ type, target }) {
    if (type === "click-button") {
      const label = target.textContent;
      if (label === "Cancel") Dialog.close();
      if (label === "Apply") layoutApply(reCreateCharts);
      return;
    }
    const label = target.textContent;
  }

  function layoutApply(reCreateCharts) {
    const { reportTitle, reportDate } = Dialog.data();
    Dialog.markErrors();
    if (reportTitle.trim() == "") {
      Dialog.markErrors({ reportTitle: "Required" });
    }
    if (reportDate.trim() == "") {
      Dialog.markErrors({ reportDate: "Required" });
    }
    if (Dialog.hasErrors) return;
    const config = Param.getParam("config");
    config.reportTitle = reportTitle.trim();
    config.reportDate = reportDate;
    // Param.setParam("config", {config});
    Dialog.close();
    reCreateCharts();
  }
}

function showChartMenus(chartID, reCreateCharts) {
  const key = getKey(chartID);
  const { chartType } = Param.getParam("chart-properties", key);
  const cannotFilterChart = cannotFilter(chartType);
  const buttons = [
    { tag: "button", label: "Filter chart" },
    { tag: "button", label: "Config chart" },
    { tag: "button", label: "Remove chart" },
    { tag: "button", label: "Clone chart" },
    { tag: "button", label: "Add calllout" },
    { tag: "button", label: "Close" },
  ];
  if (cannotFilterChart) {
    buttons[0].disabled = true;
    buttons[0].title = "Disabled as chart cannot be filtered";
  }
  const filters = getChartsWithFilter();
  if (filters.length > 0)
    [1, 2, 3, 4].forEach((n) => {
      buttons[n].disabled = true;
      buttons[n].title = "Disabled as filters on";
    });

  Dialog.make(buttons, {
    callback,
    classes: "dialog small",
    legend: "",
  }).show();

  function callback({ type, target }) {
    if (type !== "click-button") return;
    const label = target.textContent;
    Dialog.close();
    if (label === "Filter chart") filterChart(chartID, reCreateCharts);
    if (label === "Config chart") configChart(chartID, reCreateCharts);
    if (label === "Remove chart") removeChart(chartID, reCreateCharts);
    if (label === "Clone chart") cloneChart(chartID, reCreateCharts);
    if (label === "Add calllout") addCallout(chartID, reCreateCharts);
  }
}
///////////////////////////////
async function removeChart(chartID, reCreateCharts) {
  const key = getKey(chartID);
  if (Param.getParam("chart-count") === 1) {
    await Dialog.alert(`Cannot remove only chart`, ["Close"]);
    return;
  }

  const calloutProperties = Param.getParam("config").callouts;
  if (calloutProperties) {
    const callOutsWithSameKey = calloutProperties
      .map((v, i) => ({ chartNumber: v.chartNumber, position: i }))
      .filter((v) => v.chartNumber === key)
      .map((v) => Number(v.position) + 1);
    if (callOutsWithSameKey.length > 0) {
      const list =
        (callOutsWithSameKey.length === 1 ? " (" : "s (") +
        callOutsWithSameKey.join(", ") +
        ")";
      await Dialog.alert(
        `Remove dependent callout${list}, then remove this chart`,
        ["Close"]
      );
      return;
    }
  }
  const { chartTitle } = Param.getParam("chart-properties", key);
  const confirm = "Yes remove";
  const reply = await Dialog.alert(
    `Are you sure to remove chart: "${chartTitle}"?`,
    [confirm, "No keep"]
  );
  if (reply === confirm)
    if (Param.removeParam("chart", key)) reCreateCharts(key, true);
}
function cloneChart(chartID, reCreateCharts) {
  const key = getKey(chartID);
  if (Param.cloneParam("chart", key)) reCreateCharts(key, true);
}
function addCallout(chartId) {
  const key = getKey(chartId);
  showCalloutConfigDialog(key, true);
}
//////////////////////////////////////////////////////////////////// config dialog helpers
//// rules for validate:
/// return true if OK
/// return false in error
///update Dialog.error is error
// function displayGrammarTemplate(e, grammar) {
//   const template = getTemplate(grammar);
//   if (e.value.trim() == "") e.value = template;
// }
//////////////////////////////////////////////////////////////////// config dialog
function updateInitialValues(elements, values) {
  if (!values) return elements;

  const elementsWithValue = elements.map((e) => {
    if (e.elements)
      return { ...e, elements: updateInitialValues(e.elements, values) };
    const name = e.name;
    if (!name) return e;
    const value = values[name];
    if (!value) return e;
    return { ...e, value };
  });
  
  return elementsWithValue;
}
function configChart(chartID, reCreateCharts) {
  const key = getKey(chartID);
  const config = Param.getParam("config");
  const { chartProperties } = config; //Param.getParam("chart-properties", key);
  const chartProperty = chartProperties[key];
  const chartElements = noChart.chartOverlay({ config });
  const configDialog = updateInitialValues(chartElements, {
    ...chartProperty,
    position: Number(key) + 1,
  });
  Dialog.make(configDialog, {
    callback,
    classes: "dialog medium",
    legend: "Configure Chart",
  });
  showDialogOptions(chartProperty);
  Dialog.show();
  positionDialog(_.select("#" + chartID));

  function callback({ type, target }) {
    if (type === "click-button") {
      const label = target.textContent;
      if (label === "Cancel") Dialog.close();
      if (label === "Apply") configChartApply(chartID);
    }
    if (type === "change") {
      showDialogOptions(Dialog.data(), target);
    }
  }
  function configChartApply(chartID) {
    const key = getKey(chartID);
    const properties = Dialog.data();
    const { chartType } = properties;
    validateConfig();
    if (Dialog.hasErrors) return;
    Dialog.close();

    if (Param.setParam("chart-properties", { properties, index: key }))
      reCreateCharts(key, true);
  }
  function validateConfig() {
    Dialog.markErrors();
    const properties = Dialog.data();
    const { chartType } = properties;
    if (getChartTypes().includes(chartType)) {
      const { reportDate } = Param.getParam("config");
      // const isNew = ["Trend", "Bar"].includes(chartType);
      const { errors, warnings, attributes } =
        //   ? validateChart(properties, { reportDate })
        //   : Counter.validateChart(chartType, properties, { reportDate });
        validateChart(properties, { reportDate });
      if (attributes) Dialog.setElementsAttrs(attributes);
      if (warnings) Dialog.markErrors(warnings);
      console.log(errors);
      if (errors) Dialog.markErrors(errors);
      return;
    }
    Dialog.markErrors({ chartType: `Invalid value: ${chartType}` });
  }
  function showDialogOptions(dataSource, target) {
    const { chartType } = dataSource;
    const columns = Param.getParam("config").columnNames;
    Dialog.markErrors();

    const needsOverlay = target ? target.name === "chartType" : true;
    if (needsOverlay) {
      const overlay = updateInitialValues(getOverlay(chartType), dataSource);
      Dialog.overlay(overlay);
    }
    validateConfig();
    function getOverlay(chartType) {
      const config = Param.getParam("config");
      const columns = config.columnNames;
      const reportDate = config.reportDate;

      return chartTypes[chartType].chartOverlay({
        config,
        chartType,
        columns,
        reportDate,
      });
    }
  }
}

function filterChart(chartID, reCreateCharts) {
  const key = getKey(chartID);
  const allCounts = getCounts();
  const dataJson = _.select("#" + chartID + " data").getAttribute("json");
  const data = JSON.parse(dataJson);

  const oneCount = allCounts.counts[key];
  const categories = data.map((v) => ({
    tag: "checkbox",
    value: oneCount[v.x] ? oneCount[v.x].include : "disable",
    label: v.x,
    name: v.x,
  }));
  const filterDialog = [
    ...categories,
    { tag: "hr" },
    { tag: "button", label: "Cancel" },
    { tag: "button", label: "Apply", class: "disable-on-error" },
  ];
  Dialog.make(filterDialog, {
    callback,
    classes: "dialog small",
    legend: "Filter chart",
  }).show();

  function callback({ type, target }) {
    if (type === "click-button") {
      const label = target.textContent;
      if (label === "Cancel") Dialog.close();
      if (label === "Apply") applyFilter(chartID);
    }
    if (type === "change") {
      isSomeChecked();
    }
  }
  async function applyFilter(chartID) {
    if (!isSomeChecked()) return;
    Dialog.close();
    const key = getKey(chartID);
    const allCounts = getCounts();
    const oneCount = allCounts.counts[key];
    const data = Dialog.data();
    for (const key in data) {
      if (oneCount[key] !== undefined) {
        oneCount[key].include = data[key];
      }
    }
    saveCounts(allCounts);
    reCreateCharts(key);
  }
  function isSomeChecked() {
    const data = Dialog.data();
    Dialog.markErrors();
    const someChecked = Object.keys(data).some((key) => data[key]);
    if (someChecked) return true;
    const keys = Object.keys(data);
    Dialog.markErrors({ [keys[keys.length - 1]]: "Required" });
    return false;
  }
}
function showCalloutMenu(key, reCreateCharts, scrollToChart) {
  const { chartNumber } = Param.getParam("callout-properties", key);
  const buttons = [
    { label: "Go to chart" },
    { label: "Config callout" },
    { label: "Remove callout" },
    { label: "Close" },
  ];
  const elements = buttons.map((b) => ({ tag: "button", label: b.label }));

  Dialog.make(elements, {
    callback,
    classes: "dialog small",
    legend: "",
  }).show();

  function callback({ type, target }) {
    if (type !== "click-button") return;
    Dialog.close();
    const label = target.textContent;
    if (label === buttons[0].label) scrollToChart(chartNumber);
    if (label === buttons[1].label) showCalloutConfigDialog(key);
    if (label === buttons[2].label) removeCallout(key);
  }
  async function removeCallout(key) {
    const confirm = "Yes, remove";
    const reply = await Dialog.alert("Sure to remove the callout?", [
      confirm,
      "No, keep",
    ]);
    if (reply !== confirm) return;
    if (Param.removeParam("callout", key)) reCreateCharts();
  }
}
//////////////////////////////////////////////////////////////////// callout config

function showCalloutConfigDialog(key, addNew = false) {
  const { chartNumber, value, category, message } = addNew
    ? { chartNumber: key, value: "max" }
    : Param.getParam("callout-properties", key);

  const dataJson = _.select(`#${getChartId(chartNumber)} data`);
  const json = dataJson ? dataJson.getAttribute("json") : "[]";
  const data = JSON.parse(json);
  const is2X2 = Boolean(data[0]?.y);
  const categories = data.map((v) => v.x + (is2X2 ? " | " + v.y : ""));

  // const oneCount = allCounts.counts[key];
  // const { chartNumber, value, category, message } = Param.getParam("callout-properties",key)
  const okButtonLabel = addNew ? "Add" : "Apply";
  const calloutConfigDialog = [
    addNew
      ? {}
      : {
          tag: "number",
          value: Number(key) + 1,
          min: 0,
          max: Param.getParam("callout-count"),
          name: "position",
        },
    {
      tag: "number",
      value: Number(chartNumber) + 1,
      min: 0,
      max: Param.getParam("chart-count"),
      name: "chartNumber",
      // disabled: true,
    },
    { tag: "overlay", id: "chart-type" },
    // {
    //   tag: "select",
    //   // label: "Value",
    //   value: value,
    //   options: ["max", "min", "category"],
    //   name: "value",
    // },
    // { tag: "input text", value: category, name: "category" },
    // { tag: "input text", value: message, name: "message" },
    { tag: "overlay", id: "callout-overlay" },

    { tag: "hr" },
    { tag: "button", label: "Cancel" },
    // { tag: "button", label: okButtonLabel, class: "disable-on-error" },
  ];

  Dialog.make(calloutConfigDialog, {
    callback,
    classes: "dialog medium",
    legend: "Config callout",
  });
  Dialog.show();
  overlayCallout();
  function callback({ type, target }) {
    if (type == "click-button") {
      const label = target.textContent;
      if (label === okButtonLabel) applyConfigCallout(key);
      if (label === "Cancel") Dialog.close();
    }
    if (type === "change") overlayCallout();
  }
  function overlayCallout() {
    const { chartNumber } = Dialog.data();
    const { chartType } = Param.getParam("chart-properties", chartNumber - 1);
    const overlayElements = [
      {
        tag: "input",
        name: "chartType",
        value: chartType ?? "None",
        disabled: true,
      },
      { tag: "hr" },
    ];
    Dialog.overlay(overlayElements, "chart-type");
    const { valueType, categories } = Dialog.data();
    const calloutOverlay = getCalloutOverlay(chartType);
    //   {
    //     tag: "select",
    //     options: ["Max", "Min", "Category"],
    //     name: "valueType",
    //   },
    //   { tag: "select", options: categories, name: "categories" },
    // ];
    Dialog.overlay(calloutOverlay, "callout-overlay");

    return;
    const value = Dialog.getElement("value").value;
    const category = Dialog.getElement("category");
    category.disabled = value !== "category";

    const { errors } = validateCalloutConfig();
    if (errors)
      for (const key in errors) Dialog.markErrors({ key: errors[key] });
  }
  function validateCalloutConfig() {
    Dialog.markErrors();
    const properties = Dialog.data();
    // console.log(properties);
    return;
    const chartNumber = Dialog.getElement("chartNumber").value;
    const { chartType } = Param.getParam("chart-properties", chartNumber - 1);
    const { errors, output, attributes } = Counter.validateCallout(
      chartType,
      properties,
      {} //data
    );
    //set attributes
    // set errors
    //return output {top: x, bottom: y}
    if (errors) return { errors };
    if (output) Object.assign(properties, output);
    return { output: properties };
  }
  function applyConfigCallout(key) {
    const { output, errors } = validateCalloutConfig();

    if (errors) {
      for (const e in errors) Dialog.markErrors({ e: errors[e] });
      return;
    }

    const { chartNumber, position } = output;
    output.chartNumber = Number(chartNumber) - 1;
    Dialog.close();
    if (
      Param.setParam("callout-propertiess", { properies: output, index: key })
    )
      reCreateCharts();
  }
  function getDefaultCalloutMessage({
    value,
    category,
    chartType,
    x_column,
    y_column,
  }) {
    const cats = `${x_column} = ...` + y_column ? `, ${y_column} = ...` : "";

    return value === "max"
      ? "Maximum at " + cats
      : value === "min"
      ? "Minimum at " + cats
      : `Value for ... = ${category}`;
  }
  //////////////////////////////////////////////////////////////////// callout remove
}
function positionDialog(target) {
  return;
  if (!target) return;
  target.classList.add("shimmer");
  // const rect = target.getBoundingClientRect();
  // const dialog = _.select("dialog");
  // dialog.style.top = `${rect.top}px`;
  // dialog.style.left = `${rect.left}px`;
  // dialog.style.width = `${rect.width}px`;
  // dialog.style.height = `${rect.height}px`;
}
function showLoadFileDialog({ header, extention, loadFunction }) {
  const elements = [
    {
      tag: "radio",
      name: "fileType",
      label: "File type",
      options: ["Local file", "Remote file"],
    },
    { tag: "hr" },
    { tag: "text", name: "remoteFileName", label: "Remote file name" },
    { tag: "hr" },
    { tag: "button", label: "Cancel" },
    { tag: "button", label: "Load", class: "disable-on-error" },
  ];
  Dialog.make(elements, {
    callback,
    classes: "dialog medium",
    legend: header,
  });
  Dialog.show();
  validate();

  async function callback({ target, type }) {
    if (type === "change") await validate();
    if (type !== "click-button") return;
    const label = target.textContent;
    if (label === "Cancel") Dialog.close();
    if (label == "Load") {
      const { fileType } = Dialog.data();
      Dialog.close();
      if (fileType === "Remote file") loadRemote();
      else loadLocal();
    }

    function loadLocal() {
      // const input = _.createElements({input:{type:"file",accept = extention ?? ".*",value:""}}) //_.select("#file");
      const input = _.select("#file");
      const forceReloadOfSameFile = "";
      input.value = forceReloadOfSameFile;

      input.accept = extention ?? ".csv";
      const clonedElement = input.cloneNode(true);
      // Replace the original element with the new one
      input.parentNode.replaceChild(clonedElement, input);
      input.addEventListener("change", () => {
        const file = input.files[0];
        if (file) {
          console.log(file);
          const blob = URL.createObjectURL(file);
          Dialog.close();
          loadFunction(blob, file);
        }
      });
      input.click();
    }
    // const isValid = await _.isValidFile(remoteFileName)
    function loadRemote() {
      const { remoteFileName, remoteFileApi } = Dialog.data();
      // if (remoteFileName === "") return;
      // if (!isValid) return;
      Dialog.close();
      loadFunction(remoteFileName);
    }
  }
  async function validate() {
    const { fileType, remoteFileName, remoteFileApi } = Dialog.data();
    Dialog.markErrors();
    const errors = [],
      attributes = [];
    // attributes.push({ name: "colOver", attrs: ["disabled", true] });
    attributes.push({ name: "remoteFileName", attrs: ["disabled", true] });
    if (fileType === "Remote file") {
      attributes.push({ name: "remoteFileName", attrs: ["disabled", false] });
      if (remoteFileName === "") errors.push({ remoteFileName: "Required" });
      else {
        const isValidFile = await _.isValidFile(remoteFileName);
        if (!isValidFile) errors.push({ remoteFileName: "Invalid file" });
      }
    }
    Dialog.setElementsAttrs(attributes);
    Dialog.markErrors(errors);
  }
}
