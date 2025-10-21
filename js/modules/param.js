// import { resolveObjectURL } from "node:buffer";
import { _, getCounts, saveCounts } from "./util.js";
import { chartTypes } from "./chart-types.js";

export { Param };
const Param = (function () {
  "use strict";
  // const self = {} // public object - returned at end of module
  let config = {};

  function getCountOf(type) {
    if (!type) return 0;
    if (!config) return 0;
    return type === "chart"
      ? config.chartProperties
        ? config.chartProperties.length
        : 0
      : type === "callout"
      ? config.callouts
        ? config.callouts.length
        : 0
      : 0;
  }
  function getChartProps(index, getDefaults) {
    if (!config.chartProperties[index]) {
      //to do remove Logger
      // Logger.log(`Invalid call to getChartProps; index= ${index}`, "error");
      return {};
    }
    const properties = { ...config.chartProperties[index] };
    //JSON.parse(JSON.stringify(config.chartProperties[index]));
    const { chartType } = properties;
    const defaults = chartTypes[chartType].chartDefaults(properties);
    properties.chartTitleWithIndex =
      (Number(index) + 1).toString() +
      ". " +
      (properties.chartTitle ? properties.chartTitle : defaults.chartTitle);
    if (getDefaults) {
      for (const d in defaults) if (!properties[d]) properties[d] = defaults[d];
    }
    return properties;
  }
  function arrayMove(arr, from, to) {
    if (from === to) return;
    const l = arr.length;
    if (from < 0 || from >= l) return;
    if (to < 0 || to >= l) return;
    let a = [...arr];
    a[from] = undefined;
    const delta = from < to ? 1 : 0;
    a.splice(to + delta, 0, arr[from]);

    return a.filter((v) => v !== undefined);
  }
  function setChartProps({ index, properties }) {
    const newValues = { ...properties };
    let isUpdated = false;
    const chartProp = config.chartProperties[index];
    const valuesToUpdate = { ...newValues };

    // for (const key in newValues) {
    //   const value = newValues[key];
    //   if (!value) continue;
    //   if (typeof value === "string" && value.trim() === "") continue;
    //   //ignore keys starting with two or more underscores
    //   if (key.startsWith("__")) continue;
    //   //keys with one underscore are json
    //   if (key.startsWith("_")) {
    //     const obj = _.parse(value);
    //     if (_.isNoValueObject(obj)) continue;
    //   }
    //   valuesToUpdate[key] = value;
    // }
    // console.log({ newValues, valuesToUpdate });
    //toCleanObject(newValues, "set"); //unFlatten ? _unFlatten(newValues) : newValues;

    for (const [key, value] of Object.entries(valuesToUpdate)) {
      //if (chartProp[key] == undefined) continue
      if (chartProp[key] !== value) {
        chartProp[key] = value;
        isUpdated = true;
      }
    }
    if (chartProp.position) delete chartProp.position;
    //to do rename __position

    for (const key of Object.keys(chartProp)) {
      if (valuesToUpdate[key] == undefined) delete chartProp[key];
    }

    const position = Number(newValues.position) - 1;

    const chartProperties = config.chartProperties;
    const newPositions = arrayMove(
      chartProperties.map((_, i) => i),
      index,
      position
    );
    if (newPositions) {
      // console.log(index, newPositions);
      //move the charts
      const newChartProperties = newPositions.map((i) =>
        JSON.stringify(chartProperties[i])
      );
      chartProperties.forEach(
        (_, i) => (chartProperties[i] = JSON.parse(newChartProperties[i]))
      );
      //move callouts
      const callouts = config.callouts;
      if (callouts)
        callouts.forEach((v) => {
          v.chartNumber = newPositions[Number(v.chartNumber)] + "";
        });
      isUpdated = true;
    }
    if (isUpdated) console.log({ newValues, saved: chartProperties[index] });
    return isUpdated;
  }
  function removeParam(type, index) {
    if (!type) return false;
    return type === "chart"
      ? removeChart(index)
      : type === "callout"
      ? removeCallOut(index)
      : false;
  }
  function removeChart(index) {
    if (!config.chartProperties) return false;
    if (index < 0) return false;
    const chartProperties = config.chartProperties;
    if (index > chartProperties.length - 1) return false;

    chartProperties.splice(index, 1);
    if (config.callouts)
      config.callouts.forEach((co) => {
        const chartNumber = co.chartNumber;
        if (chartNumber === undefined) return;
        if (chartNumber < index) co.chartNumber = Number(chartNumber) - 1 + "";
      });

    return true;
  }

  function cloneParam(type, index) {
    if (!type) return;
    if (!config.chartProperties) return false;
    if (index < 0) return false;
    const chartProperties = config.chartProperties;
    if (index > chartProperties.length - 1) return false;
    const newValue = JSON.parse(JSON.stringify(chartProperties[index]));

    chartProperties.splice(index, 0, newValue);
    if (config.callouts)
      config.callouts.forEach((co) => {
        const chartNumber = co.chartNumber;
        if (chartNumber === undefined) return;
        if (chartNumber > index) co.chartNumber = Number(chartNumber) + 1 + "";
      });

    return true;
  }

  function getAutoTitle(chartProp) {
    return "delete";
    if (!chartProp) return "";
    const {
      chartType,
      countType,
      colOver,
      x_bin,
      x_column,
      x_label,
      x_labels,
      y_column,
      y_label,
      y_labels,
    } = chartProp;
    const x = _.pick1stNonBlank(x_label, x_column);
    const y = _.pick1stNonBlank(y_label, y_column);
    if (!chartType) return "";
    //     string, date
    const countPrefix = () => {
      if (countType === "Count") return "Count";
      if (countType === "Sum") return `Sum of ${colOver}`;
      return `Av of ${colOver}`;
    };

    if (["Note", "Data Description", "Data Table", "Plan"].includes(chartType))
      return chartType.toUpperCase();

    if (chartType === "Trend" || chartType === "Trend OC")
      return `${x} over time`.toUpperCase();

    if (chartType === "Risk") return `${countPrefix()} by Risk`.toUpperCase();

    if (chartType === "2X2")
      return `${countPrefix()} by ${x} and ${y}`.toUpperCase();

    if (chartType === "State Change")
      return `State Change: ${countType}`.toLocaleUpperCase();

    if (chartType === "Bar") {
      const binned = x_bin ? "Binned " : "";
      // const list = chartType === "List" ? "Members in " : ""
      // const list = chartType === "List Members"? "Members in " : ""
      return `${binned}${countPrefix()} by ${x}`.toUpperCase();
    }

    return `undefined: ${chartType}`.toUpperCase();
  }
  //////////////////////////////////////////////////////////// callout functions
  // function getCallOut(id) {
  //     //move to c
  //     const { countType, chartType, bin, order } = config.chartProperties[id]
  //     // console.log(id, chartType)
  //     if (
  //         [
  //             "Note",
  //             "Data Table",
  //             "Data Description",
  //             "Trend",
  //             "List Count",
  //             "List Members",
  //         ].includes(chartType)
  //     )
  //         return {
  //             topMessage: "No call outs",
  //             value: "NA",
  //             bottomMessage: "NA",
  //         }
  //     const allCounts = getCounts()
  //     const oneCount = allCounts.counts[key]
  //     if (chartType == "Trend") console.log(oneCount)
  //     const categories = Object.keys(oneCount)

  //     let category = categories[0]
  //     if (!oneCount[category])
  //         return {
  //             topMessage: "No call outs",
  //             value: "NA",
  //             bottomMessage: "NA",
  //         }
  //     let value = oneCount[category].filteredCount

  //     function getMinMax(callValue) {
  //         categories.forEach((cat) => {
  //             const categoryValue = oneCount[cat].filteredCount
  //             if (
  //                 (callValue == "min" && value > categoryValue) ||
  //                 (callValue == "max" && value < categoryValue)
  //             ) {
  //                 value = categoryValue
  //                 category = cat
  //             }
  //         })
  //     }

  //     const { callValue, callCategory } = {
  //         callValue: "max",
  //         callCategory: "P1",
  //     }

  //     if (callValue == "category") {
  //         category = callCategory
  //         if (!oneCount[category])
  //             return {
  //                 topMessage: "No call outs",
  //                 value: "NA",
  //                 bottomMessage: "NA",
  //             }
  //         value = oneCount[category].filteredCount
  //     } else getMinMax(callValue)

  //     const topMessage =
  //         callValue == "min" ? "Minimum value" : "Maximum value"
  //     return {
  //         value,
  //         topMessage,
  //         bottomMessage: category,
  //     }
  // }
  function removeCallOut(index) {
    if (!config.callouts) return false;
    if (index === undefined) return false;
    if (!config.callouts[index]) return false;
    config.callouts.splice(index, 1);
    return true;
  }

  function getCallOutProps(index) {
    return config.callouts[index];
  }
  function setCallOutProps({ index, properties }) {
    const newValue = { ...properties };
    if (!config.callouts) config.callouts = [];
    const cleanedNewValue = _.cleanObject(newValue);

    if (index === undefined) {
      config.callouts.push(cleanedNewValue);
      return true;
    }
    if (!config.callouts[index]) return false;

    const position = Number(cleanedNewValue.position) - 1;
    delete cleanedNewValue.position;

    const callout = config.callouts[index];
    for (const key in callout) delete callout[key];
    for (const key in cleanedNewValue) callout[key] = cleanedNewValue[key];

    const callouts = config.callouts;
    const newPositions = arrayMove(
      callouts.map((_, i) => i),
      Number(index),
      position
    );
    if (newPositions) {
      const newCallouts = newPositions.map((i) => JSON.stringify(callouts[i]));
      callouts.forEach((_, i) => (callouts[i] = JSON.parse(newCallouts[i])));
    }
    return true;
  }
  function autoCreateConfig(file, dataDescription, action) {
    createDefaultConfig();
    createDefaultChartProperties();
    createDefaultCallouts();

    function autoType(chartProp) {
      const { dateCount, numberCount, stringCount } =
        dataDescription[chartProp];
      if (dateCount > 0 && numberCount == 0 && stringCount == 0) return "Date";
      if (numberCount > 0 && dateCount == 0 && stringCount == 0)
        return "Number";
      return "String";
    }
    function createDefaultConfig() {
      const d = new Date();
      config.reportDate = d.toISOString().substring(0, 10);
      config.reportTitle = "Auto-genearted Dashboard";
      config.maxValues = "30";
      config.files = [file];
      config.preview = 2000;
    }
    function createDefaultChartProperties() {
      config.columnNames = [];
      config.columnTypes = [];
      config.callouts = []; //use in future
      config.chartProperties = [];
      const chartProperties = config.chartProperties;
      for (const colName in dataDescription) {
        const chartType = autoType(colName);
        const chartProp = {
          chartSize: "Small",
          countType: "Count",
          chartType: "Bar",
          x_dataType: chartType,
          x_column: colName,
        };
        if (chartProp.x_dataType === "Date") chartProp.x_dateFormat = "MMM";
        if (chartProp.x_dataType === "Number") chartProp.x_bin = "5";

        chartProperties.push(chartProp);
      }
      chartProperties.forEach((v) => {
        config.columnNames.push(v.x_column);
        config.columnTypes.push(v.x_dataType);
      });
      //add table
      chartProperties.push({
        chartType: "Data Table",
        chartSize: "Large",
        rowsToDisplay: "10",
      });
      //add description
      chartProperties.push({
        chartType: "Data Description",
        chartSize: "Large",
      });

      const message =
        "The input has the following data headers (value in bracket indicates chart type assumed):" +
        config.columnNames.reduce(
          (list, column, i) =>
            `${list}\n${i + 1}. ` + `${column} (${config.columnTypes[i]})`,
          ""
        );
      chartProperties.unshift({
        chartType: "Note",
        chartSize: "Small",
        message: message,
      });
    }
    function createDefaultCallouts() {
      config.callouts = [];
      for (let i = 0; i < config.chartProperties.length; i++)
        if (config.chartProperties[i].chartType === "Bar")
          config.callouts.push({
            chartNumber: i,
            value: "max",
          });
    }
  }
  function getConfig() {
    return config;
  }
  function setConfig({ newConfig, file, dataDescription, replace }) {
    if (!newConfig) {
      autoCreateConfig(file, dataDescription);
      return true;
    }
    if (replace) {
      config = JSON.parse(JSON.stringify(newConfig));
      return true;
    }
    if (!newConfig && !dataDescription) {
      config.file = [file];
      return;
    }
    Object.assign(config, {});
    Object.assign(config, newConfig);
    return true;
  }
  function getParam(type, index, getDefaults) {
    if (type === "chart-count") return getCountOf("chart");
    if (type === "callout-count") return getCountOf("callout");
    if (type === "chart-properties") return getChartProps(index, getDefaults);
    if (type === "callout-properties")
      return getCallOutProps(index, getDefaults);
    if (type === "config") return getConfig();
  }
  function setParam(type, newValues, index) {
    if (type === "chart-properties") return setChartProps(newValues);
    if (type === "callout-properties") return setCallOutProps(newValues);
    if (type === "config") return setConfig(newValues);
  }
  return {
    removeParam,
    cloneParam,
    getParam,
    setParam,
    // getAutoTitle, //getParam("auto-title")
    // getParamAuto,
  };
})();

function toCleanObject(obj) {
  const validPrefixes = [];
  const seperator = "-";
  const cleanedObject = {};

  for (const key in obj) {
    if (!key.includes(seperator)) continue;
    const prefix = key.split(seperator)[0];
    if (typeof obj[prefix] !== undefined)
      if (!validPrefixes.includes(prefix)) validPrefixes.push(prefix);
  }
  for (const key in obj) {
    const value = obj[key];
    if (!value) continue
    if (!key.includes(seperator)) {
      cleanedObject[key] = value;
      continue;
    }

    const prefix = key.split(seperator)[0];
    if (validPrefixes.includes(prefix)) continue;

    cleanedObject[key] = value;
  }
  return cleanedObject;
}

// function parse(key) {
//   const prefix = getPrefix(key);
//   try {
//     const x = JSON.parse(obj[key]);
//     for (key in x) {
//       x[prefix + key] = x[key];
//       delete x[key];
//     }
//     return x;
//   } catch (error) {
//     return {};
//   }
// }
// function isValidPrefix(key) {
//   // return validPrefixes.includes(key);
//   if (!key.includes(seperator)) return false;
//   if (key.split(seperator)[1]) return false;
//   return true;
// }
// function stringify(key) {
//   const prefix = key.split(seperator)[0] + seperator;
//   if (prefixexDone.includes[prefix]) return;
//   prefixexDone.push(prefix);
//   const x = {};
//   for (const k in obj)
//     if (k.startsWith(prefix)) {
//       const newKey = k.split(seperator)[1];
//       x[newKey] = obj[k];
//     }
//   try {
//     return JSON.stringify(x);
//   } catch (error) {
//     return { key: prefix, value: "JSON.stringify error" };
//   }
// }
// function hasPrefix(key) {
//   const [prefix, suffix] = key.split(seperator);
//   if (!suffix) return false;
//   // console.log({key, suffix, is:isValidPrefix(prefix)})
//   return isValidPrefix(prefix + seperator);
// }
// function getPrefix(key) {
//   return key.split(seperator)[0] + seperator;
// }
