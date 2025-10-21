"use strict";
import {
  DISPLAY_OTHERS,
  DISPLAY_INVALID,
  DISPLAY_INVALID_NUMBER,
  DISPLAY_INVALID_DATE,
  DISPLAY_SPACES,
  DISPLAY_LESS,
  DISPLAY_MORE,
  isInvalidDisplay,
  displayOrder,
  MONTHS,
  WEEKDAYS,
  WORKDAYS,
  MAX_BAR_CATS,
  MAX_2X2_CATS,
} from "./common.js";
export {
  _,
  saveCounts,
  getCounts,
  setItem,
  getItem,
  getChartId,
  getChartContainer,
  getKey,
  clearCounts,
};

const _ = (function () {
  /*
   * Formats a date string using the format
   *
   * @param {string} date to be formatted
   * @param {string} format any combination of dd mm mmm yy and yyyy
   * @returns {string} formatted date
   */
  function formatDate(date, format) {
    if (!isValidDate(date)) {
      console.log(date);
      return DISPLAY_INVALID_DATE;
    }
    const dateWithHyphen = date.replace(/\//g, "-").toUpperCase().trim();
    const newDate = new Date(dateWithHyphen);
    const date_DDD_MMM_DD_YYYY = newDate.toDateString();
    const dateParts = date_DDD_MMM_DD_YYYY.split(" ");

    const DDD = dateParts[0];
    if (DDD == "Invalid") return DISPLAY_INVALID_DATE;
    if (!format) return true;
    const MMM = dateParts[1];
    const monthNumber = newDate.getMonth() + 1;
    const MM = (monthNumber < 10 ? "0" : "") + monthNumber.toString();
    const DD = dateParts[2];
    const YYYY = dateParts[3];
    const YY = YYYY.substring(2, 4);

    // let formattedDate = format.replace("DDD", DDD)
    // formattedDate = formattedDate.replace("DD", DD)
    // formattedDate = formattedDate.replace("MMM", MMM)
    // formattedDate = formattedDate.replace("MM", MM)
    // formattedDate = formattedDate.replace("YYYY", YYYY)
    // formattedDate = formattedDate.replace("YY", YY)

    const formattedDate = format
      .replace("DDD", DDD)
      .replace("DD", DD)
      .replace("MMM", MMM)
      .replace("MM", MM)
      .replace("YYYY", YYYY)
      .replace("YY", YY);

    return formattedDate;
  }
  /**
   * Tests if a date is valid
   * @param {string} date - valid formats are dd-mmm-yy, yyyy-mm-dd
   * @returns {boolean}
   */
  function isValidDate(date) {
    function isDateOK(DD, MM, YYYY) {
      if (YYYY < 2000) return false;
      if (MM > 12) return false;
      const days = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      if (MM != 2) return DD <= days[MM - 1];
      if (DD <= 28) return true;
      const isLeapYear = YYYY % 100 == 0 ? YYYY % 400 == 0 : YYYY % 4 == 0;
      if (isLeapYear && DD == 29) return true;
      return false;
    }

    if (typeof date !== "string") return false;
    const dateWithHyphen = date.replace(/\//g, "-").toUpperCase().trim();

    const YYYY_MM_DD = /[0-9]{4}-[0-9]{2}-[0-9]{2}/g;
    if (dateWithHyphen.search(YYYY_MM_DD) == 0) {
      if (date.length != 10) return false;
      const dateParts = date.split("-");
      const YYYY = Number(dateParts[0]);
      const MM = Number(dateParts[1]);
      const DD = Number(dateParts[2]);
      return isDateOK(DD, MM, YYYY);
    }

    const DD_MMM_YY = /[0-9]{2}-[A-Z]{3}-[0-9]{2}/gi;
    if (dateWithHyphen.search(DD_MMM_YY) == 0) {
      if (date.length != 9) return false;
      const dateParts = dateWithHyphen.split("-");
      const YYYY = 20 + Number(dateParts[3]);
      const MMM = dateParts[1];
      const DD = Number(dateParts[0]);
      const MM = MONTHS.findIndex((v) => v.toUpperCase() == MMM) + 1;
      if (MM == 0) return false;
      return isDateOK(DD, MM, YYYY);
    }
    const DD_MMM_YYYY = /[0-9]{2}-[A-Z]{3}-[0-9]{4}/gi;
    if (dateWithHyphen.search(DD_MMM_YYYY) == 0) {
      if (date.length != 11) return false;
      const dateParts = dateWithHyphen.split("-");
      const YYYY = Number(dateParts[3]);
      const MMM = dateParts[1];
      const DD = Number(dateParts[0]);
      const MM = MONTHS.findIndex((v) => v.toUpperCase() == MMM) + 1;
      if (MM == 0) return false;
      return isDateOK(DD, MM, YYYY);
    }
    return false;
  }

  function dateTimeDiff(dateTimeStart, dateTimeEnd, format = "Days") {
    function workdays(startDate, endDate) {
      let workdays = 0;
      let currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.toDateString().substring(0, 3);
        const isWorkDay = WORKDAYS.findIndex((v) => v == dayOfWeek) != 1;
        if (isWorkDay) workdays++;
        currentDate = new Date(currentDate.getTime() + milliSecondsInDay);
      }

      return workdays - 1;
    }

    const start = new Date(dateTimeStart);
    const end = new Date(dateTimeEnd);
    const diffTimeMilliseconds = end - start;
    const formatUC = format.toUpperCase().trim();
    if (formatUC == "MILLISECONDS") return diffTimeMilliseconds;
    const milliSecondsInDay = 1000 * 60 * 60 * 24;
    if (formatUC == "WORKDAYS") return workdays(start, end);
    const days = Math.ceil(diffTimeMilliseconds / milliSecondsInDay);
    if (formatUC == "DAYS") return days;
    if (formatUC == "WEEKS") return days / 7;
  }

  function addDays(dateTimeStart, days) {
    if (isNaN(days) || days === 0) return dateTimeStart;

    const start = new Date(dateTimeStart);
    const daysInMS = 24 * 60 * 60 * 1000 * Number(days);
    start.setTime(start.getTime() + daysInMS);

    return start.toISOString().substring(0, 10);
  }

  function getCSSVar(v) {
    const style = getComputedStyle(document.body);
    return style.getPropertyValue(v);
  }
  ///////////////////////////////// DOM helpers

  /**
   * Creates a set of elements based on html
   *
   * @param {string} html
   * @returns html elements to be appended to a parent element
   */
  // const _createElements = (html) => {
  //     let temp = document.createElement("template")
  //     html = html.trim()
  //     temp.innerHTML = html
  //     return temp.content.firstChild
  // }

  /**
   * Remove the innerHTML and event listeners for an element
   * @param {string} selector for the element
   * @returns {HTMLElement}
   */
  const clearHTML = (selector) => {
    const element = typeof selector === "string" ? select(selector) : selector;
    if (element) element.textContent = "";
    // if (element)
    //   while (element.firstChild) {
    //     element.lastChild.replaceWith(element.lastChild.cloneNode(true)); //removes any event listener
    //     element.removeChild(element.lastChild);
    //   }

    return element;
  };

  /**
   *
   * @param {string} type
   * @param {string} selector
   * @param {function} callback
   * @param {object} options
   * @param {HTMLElement} parent
   */
  function addGlobalEventListener(
    type,
    selector,
    callback,
    options,
    parent = document
  ) {
    parent.addEventListener(
      type,
      (e) => {
        if (e.target.matches(selector)) callback(e);
      },
      options
    );
  }

  function sleep(timeInMilliSeconds) {
    return new Promise((resolve) => setTimeout(resolve, timeInMilliSeconds));
  }

  //https://github.com/WebDevSimplified/js-util-functions/

  function select(selector, parent = document) {
    return parent.querySelector(selector);
  }

  function selectAll(selector, parent = document) {
    return [...parent.querySelectorAll(selector)];
  }

  /**
   * Create DOM element(s) given the input.
   *
   * @example input: "<div class='x'></div>", output a div element with a class
   * @example input: {div: {class: "x", style: "y"}} output: div element with class and style
   * @example input: {div: {class: "x", style: "y", button: {class:"z"}}} output: div element with class and style
   * and a child button with class
   *
   * @param {String|Object|Array} input
   * @returns {HTMLElement}
   */
  function createElements(input) {
    const getTag = (tag) => {
      const underscore = tag.indexOf("_");
      if (underscore === -1) return tag;
      return tag.substring(0, underscore);
    };

    if (typeof input === "string" && input.includes("<")) {
      let temp = document.createElement("template");
      const html = input.trim();
      temp.innerHTML = html;
      return temp.content.firstChild;
    }
    if (typeof input === "string") {
      return document.createElement(input.trim());
    }

    if (typeof input !== "object") return;

    const key = Object.keys(input)[0];

    const element = document.createElement(getTag(key));
    const attributes = input[key];
    if (typeof attributes !== "object") return element;

    Object.entries(attributes).forEach(([attr, value]) => {
      if (typeof value === "object") {
        const childAttrs = {};
        childAttrs[attr] = value;
        const child = createElements(childAttrs);
        if (child) element.appendChild(child);
        return;
      }

      if (attr === "class") {
        if (typeof value !== "string") return;
        const classes = value.split(" ");
        for (const c of classes) element.classList.add(c);
        return;
      }

      if (attr === "dataset") {
        if (typeof value !== "array") return;
        Object.entries(value).forEach(([dataKey, dataValue]) => {
          element.dataset[dataKey] = dataValue;
        });
        return;
      }

      if (attr === "text") {
        if (typeof value !== "string") return;
        element.textContent = value;
        return;
      }
      if (attr === undefined) {
        return;
      }
      if (typeof value === "string") element.setAttribute(attr, value);
    });

    return element;
  }

  /**
   *
   * @param {object} obj
   * @returns {object}
   */
  function flatten(obj, parent, flattened = {}) {
    for (let key in obj) {
      let property = parent ? parent + "_" + key : key;
      if (typeof obj[key] === "object") {
        flatten(obj[key], property, flattened);
      } else {
        flattened[property] = obj[key];
      }
    }
    return flattened;
  }
  /**
   *
   * @param {object} obj
   * @returns {object}
   */
  function unFlatten(obj) {
    Object.keys(obj).reduce((res, k) => {
      k.split("_").reduce(
        (acc, e, i, keys) =>
          acc[e] ||
          (acc[e] = isNaN(Number(keys[i + 1]))
            ? keys.length - 1 === i
              ? obj[k]
              : {}
            : []),
        res
      );
      return res;
    }, {});
  }

  function cleanArray(inString, format) {
    const inArray = inString.split(",");
    const outArray = [];
    inArray.forEach((v) => {
      const val = v.trim();
      outArray.push(format === "Number" ? Number(val) : val);
    });
    return outArray;
  }
  /**
   * Generate a clean array from input string
   * @param {string} input Input string with values
   * @param {string} delim Delimiter separating the values
   * @param {string} format Decides type of the result. "number" returns array of numbers else array of string items
   * @returns {string[]|number[]}
   */
  function getArray(input, options) {
    const { delim, format } = { delim: ",", format: "string", ...options };
    const arr = input.split(delim);
    return format === "number"
      ? arr.map((v) => Number(v)).filter((v) => !isNaN(v))
      : arr.map((v) => v.trim());
  }

  function toMap(arr) {
    const map = new Map();
    if (Array.isArray(arr))
      for (let i = 0; i < arr.length; i += 2) {
        const key = arr[i];
        const value = arr[i + 1];
        map.set(key, value);
      }
    return map;
  }

  function removeChildren(selector) {
    const parent = select(selector);

    // parent.replaceChildren()

    while (parent.firstChild) {
      parent.lastChild.replaceWith(parent.lastChild.cloneNode(true)); //removes any event listener
      parent.removeChild(parent.lastChild);
    }
  }
  function sortArrayOrObjects(arrObj, { key, order = "a" }) {
    const isArray = Array.isArray(arrObj);
    const value = (x) => (typeof key === "function" ? key(x) : x[key]);
    const sortedArrObj = arrObj.sort((a, b) => {
      const aValue = value(a);
      // console.log(aValue, a[(key, Array.isArray(arrObj))])
      const bValue = value(b);
      if (aValue < bValue) return -1;
      if (aValue > bValue) return 1;
      return 0;
    });
    return order === "d" ? sortedArrObj.reverse() : sortedArrObj;
  }

  function sortComparator(a, b, { arrange = "a", order: [] }) {
    const compare = arrange === "a" ? -1 : arrange === "d" ? 1 : 0;
    const action = (a, b, c) => (a < b ? c : a > b ? -c : 0);

    if (Array.isArray(order)) {
      const aIndex = order.findIndex((v) => v === a);
      const bIndex = order.findIndex((v) => v === b);

      if (aIndex > -1 && bIndex > -1) return action(aIndex, bIndex, -1);
      if (aIndex > -1) return -1;
      if (bIndex > -1) return 1;
    }

    return action(a, b, compare);
  }

  function tokenize(input, delimiters) {
    const getDelimAt = (ptr) => {
      for (const delim of delimiters)
        if (delim === input.substring(ptr, ptr + delim.length)) return delim;
      return "";
    };

    const tokens = [];
    let token = "";
    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      const delimAt = getDelimAt(i);
      if (delimAt !== "") {
        if (token) tokens.push(token);
        tokens.push(delimAt);
        token = "";
        i += delimAt.length - 1;
        continue;
      }
      token += char;
    }
    if (token) tokens.push(token);

    return tokens;
  }
  function isEmptyObject(obj) {
    return Object.keys(obj).length === 0;
  }
  function isNoValueObject(obj) {
    const values = Object.values(obj).map((v) =>
      typeof v === "string" ? v.trim() : "x"
    );
    return values.join("") === "";
  }

  function is2X2(chartType) {
    return ["Risk", "2X2", "State Change"].includes(chartType);
  }
  const isTable = (chartType) =>
    ["Data Table", "Data Description"].includes(chartType);
  const isTrend = (chartType) => ["Trend OC", "Trend"].includes(chartType);

  function niceJoin(arr, { main = ", ", last = " or " } = {}) {
    return arr.reduce(
      (acc, v, i) =>
        acc +
        v +
        (i === arr.length - 2 ? last : i === arr.length - 1 ? "" : main),
      ""
    );
  }
  function isInteger(x) {
    if (isNaN(x)) return false;
    return Number.isInteger(Number(x));
  }
  function isArray(arr, { order }) {
    if (!Array.isArray(arr)) return false;
    if (typeof order !== "string") return;
    const isAscending = order.toLowerCase[0] === "a";

    const isTupleOrdered = (a, b) => (isAscending ? a >= b : b >= a);
    const isOrdered = arr.every(
      (v, i) => i === 0 || isTupleOrdered(v, arr[i - 1])
    );
    return isOrdered;
  }
  function pick1stNonBlank(...args) {
    const x = args.find(
      (arg) => arg && typeof arg === "string" && arg.trim() !== ""
    );
    return x ? x.trim() : "";
  }
  function cleanObject(input) {
    const output = {};
    if (typeof input !== "object") return output;
    Object.keys(input).forEach((key) => {
      const value = input[key];
      if (typeof value === "undefined") return;

      if (typeof value === "number") {
        output[key] = value + "";
        return;
      }
      if (typeof value === "object") {
        output[key] = cleanObject(value);
        return;
      }
      if (typeof value !== "string") return;
      if (value.trim() === "") return;
      output[key] = value.trim();
    });
    return output;
  }
  function isUndefinedString(v) {
    if (v === undefined) return true;
    if (typeof v !== "string") return true;
    if (v.trim() === "") return true;
    return false;
  }
  function stringify(obj) {
    try {
      return JSON.stringify(obj);
    } catch (e) {
      return '{"error":"stringify failed"}';
    }
  }

  function parse(str) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return { error: "parse failed" };
    }
  }
  async function isValidFile(url) {
    try {
      const response = await fetch(url, { method: "HEAD" });
      return response.status === 200;
    } catch (error) {
      console.error("Error fetching URL:", error);
      return false;
    }
  }
  function toRows(str, rowLength) {
    const arr = [];
    if (!isPresent(str)) return arr;
    if (!(rowLength && !isNaN(rowLength))) return arr;

    const strArr = str.split(",").map((v) => v.trim());
    for (let i = 0; i < strArr.length; i += Number(rowLength)) {
      arr.push(strArr.slice(i, i + Number(rowLength)));
    }
    return arr;
  }
  function isPresent(str) {
    return str && typeof str === "string" && str.trim() !== "";
  }
  return {
    formatDate,
    isValidDate,
    dateTimeDiff,
    addDays,
    getCSSVar,
    clearHTML,
    addGlobalEventListener,
    sleep,
    select,
    selectAll,
    createElements,
    flatten,
    unFlatten,
    cleanArray,
    getArray,
    toMap,
    removeChildren,
    sortArrayOrObjects,
    isEmptyObject,
    isNoValueObject,
    is2X2,
    isTable,
    sortComparator,
    tokenize,
    isTrend,
    niceJoin,
    isInteger,
    isArray,
    pick1stNonBlank,
    cleanObject,
    isUndefinedString,
    toSentence,
    stringify,
    parse,
    isValidFile,
    toRows,
    isPresent,
  };
})();

function saveCounts(x) {
  setItem("allCounts", JSON.stringify(x));
}
function getCounts() {
  return JSON.parse(getItem("allCounts"));
}

function setItem(key, value) {
  localStorage.setItem(key, value);
  // store[key] = value
}
function getItem(key) {
  return localStorage.getItem(key);
  // console.assert(store[key], `${key} is not found`)
  // return store[key]
}

function getChartId(key) {
  return "chart-" + key;
}

function getChartContainer(key) {
  return "chart-container-" + key;
}
function getKey(id) {
  return id.replace("chart-", "");
}
function clearCounts() {
  saveCounts({});
}
function toSentence(name) {
  //camel case to sentence
  if (!name) return "Undefined";
  const nameParts = name.split(/(?=[A-Z])/);
  let label = nameParts.join(" ").toLowerCase();
  return label[0].toUpperCase() + label.substring(1);
}
