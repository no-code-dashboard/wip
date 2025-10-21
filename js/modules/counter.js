"use strict";
import { extent as d3Extent } from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { _ } from "./util.js";
// import Papa from 'papaparse'
// import 'https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js';
//no-code-dashboard-12:59
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
// import {
//   parseGrammar,
//   PLAN_GRAMMAR,
//   TREND_GRAMMAR,
//   CHART_FILTER_GRAMMAR,
//   CALL_OUT_2X2_GRAMMAR,
//   CALL_OUT_BAR_GRAMMAR,
//   CALL_OUT_FIXED_GRAMMAR,
// } from "./grammar.js";
import { dataTypes } from "./data-types.js";
import { chartTypes, getParsedValue } from "./chart-types.js";

export { Counter };

const Counter = (function () {
  const SYMBOL_OTHERS = Symbol(DISPLAY_OTHERS);
  const SYMBOL_INVALID = Symbol(DISPLAY_INVALID);
  const SYMBOL_INVALID_NUMBER = Symbol(DISPLAY_INVALID_NUMBER);
  const SYMBOL_INVALID_DATE = Symbol(DISPLAY_INVALID_DATE);
  const SYMBOL_SPACES = Symbol(DISPLAY_SPACES);
  const SYMBOL_LESS = Symbol(DISPLAY_LESS);
  const SYMBOL_MORE = Symbol(DISPLAY_MORE);

  function symbolToDisplay(v) {
    if (typeof v === "symbol") return v.description;
    return v;
  }
  function getDisplayValue(countType, v) {
    const count = v.count != undefined ? v.count : v.filteredCount;
    const sum = v.sum != undefined ? v.sum : v.filteredSum;

    if (countType.startsWith("Sum")) return sum;

    const av = count > 0 ? Number((sum / count).toFixed(1)) : 0;
    if (countType.startsWith("Average")) return av;

    return count;
    // if (countType == "Sum" || countType == "Sum of Transition Duration")
    // return sum
    // if (
    //     countType == "Average" ||
    //     countType == "Average of Transition Duration"
    // )
    // return count > 0 ? Number((sum / count).toFixed(1)) : 0
  }
  async function readCSV(
    resolveValue,
    { file, step, error, complete, preview = 0, token }
  ) {
    const downloadRequestHeaders = token
      ? {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3.raw",
        }
      : undefined;
    const p = await new Promise((resolve) => {
      Papa.parse(file, {
        delimiter: ",",
        download: true,
        // worker: true,
        header: true,
        skipEmptyLines: true,
        downloadRequestHeaders,
        preview,
        step: (row) => step(row),
        error: (err, file) => {
          console.log("EEEE", err);
          resolve({ err });
        },
        complete: (result, file) => {
          resolve(resolveValue);
          complete(result, file);
        },
      });
    });
    return p;
  }

  function getOrderedValues(chartType, chartProp, param) {
    if (!chartType) return [];
    if (!chartTypes[chartType]) return [];

    const orderedValues = chartTypes[chartType].orderedValues;
    if (orderedValues) return orderedValues(chartProp, param);
    return [];
  }

  async function getFirstRecord(file) {
    let firstRow;
    return await readCSV(firstRow, {
      file,
      step: (row) => {
        firstRow = row;
      },
      error: (err, file) => console.error({ err, file }),
      complete: () => {
        //resolve(firstRow)
      },
    });
  }

  async function getCountsFromFile(inputJSON) {
    const SYMBOL_PREV_STATE = Symbol();
    let totalRowCounts = 0,
      filteredRowCounts = 0,
      isStartOfFile = true,
      fileError,
      dataDescription = {};

    totalRowCounts = 0;
    filteredRowCounts = 0;
    const { filter, config, blob } = JSON.parse(inputJSON);
    //to do deal with multiple files
    const file = blob ? blob : config.files[0];

    const preview = config ? config.preview : 2000;
    if (!config) {
      await passOne(file, 0, preview);
      return dataDescription;
    }
    const hasFilterInInput = filter !== undefined;
    function hasFilter(x_column) {
      const { chartProperties } = config;
      const charts = chartProperties
        .map((chart, i) => ({ ...chart, key: i }))
        .filter((chart) => chart.x_column === x_column);

      let someHaveFilter = false;
      const isFalse = (v) => v !== undefined && !v;

      for (const chart of charts) {
        const count = allCounts.counts[chart.key];
        for (const cat in count)
          if (isFalse(count[cat].include)) someHaveFilter = true;
      }
      return someHaveFilter;
    }
    const allCounts = hasFilterInInput
      ? JSON.parse(JSON.stringify(filter))
      : { memo: {}, counts: {}, callouts: {} };

    if (hasFilterInInput) zeroCounters(allCounts);

    const { presetOffsetDays } = config;
    // TO DO too many async awaits - simplify

    ////////////////////////////////////////////////////////////////////////// pass 1
    if (filter === undefined) {
      await passOne(file, presetOffsetDays, preview);
      if (fileError) {
        console.log(fileError);
        log(fileError.err, "0", "error");
        return allCounts;
      }
      allCounts.memo.dataDescription = dataDescription;
    }
    clearLog();
    const pass1allCounts = await passTwo(file, allCounts);
    const files = config.files;
    const hasOneFile = file ? true : files.length === 1;
    if (hasOneFile) return pass1allCounts;

    // return await passTwo(files[1], pass1allCounts, true);
    /////////////////////////////////////////////////////////////////
    function passTwo(file, allCounts, secondFile = false) {
      const counts = secondFile ? {} : allCounts;
      const response = /* await */ readCSV(counts, {
        file,
        step: (uncleanRow) => {
          if (uncleanRow.errors.length > 0) {
            console.error(errors);
          }
          const row = cleanRow(uncleanRow.data, presetOffsetDays);
          countRecords(counts, row);
        },
        error: (err, file) => console.error({ err, file }),
        complete: () => {
          wrapUp(counts);
        },
      });
      return response;
    }
    function countRecords(allCounts, row) {
      const isEndOfFile = !row;
      if (isEndOfFile) {
        if (!allCounts.memo.global) allCounts.memo.global = {};

        Object.assign(allCounts.memo.global, {
          totalRowCounts,
          filteredRowCounts,
        });

        for (const key in allCounts.counts) countBasedOnType(key);

        return;
      }
      totalRowCounts++;

      let rowForFilter = new Array(config.chartProperties.length).fill(
        undefined
      );

      for (const key in rowForFilter) {
        if (!allCounts.counts[key]) allCounts.counts[key] = {};
        countBasedOnType(key, false);
      }
      isStartOfFile = false;

      let includeRowInReport = true;
      for (const key in rowForFilter) {
        const { chartType } = getChartProps(key);
        if (cannotFilter(chartType)) continue;
        const value = rowForFilter[key];
        if (value === undefined) continue;
        if (!allCounts.counts[key][value])
          console.log({
            key,
            value,
            totalRowCounts,
            rowForFilter,
            count: allCounts.counts[key],
          });
        if (!allCounts.counts[key][value].include) {
          includeRowInReport = false;
          break;
        }
      }
      if (!includeRowInReport) return;

      filteredRowCounts++;

      for (const key in rowForFilter) {
        if (includeRowInChart(key, row)) countBasedOnType(key, true);
      }
      function getSumValue(key, countColumn) {
        if (!countColumn) return 0;
        const value = row[countColumn];
        if (!isValidData(value, "number", "Av/Sum", key)) return 0;
        return Number(value);
      }
      function countTable(key, oneCount, isFiltered) {
        if (isEndOfFile) return;
        const { rowsToDisplay } = getChartProps(key);
        if (!isFiltered) return;
        if (Object.keys(oneCount).length >= rowsToDisplay) {
          //delete the middle one
          delete oneCount[filteredRowCounts - Math.round(rowsToDisplay / 2)];
        }
        if (!oneCount[filteredRowCounts])
          oneCount[filteredRowCounts] = { include: true };
        oneCount[filteredRowCounts].filteredValue = row;
      }
      function countDataDescription(key, oneCount, isFiltered) {
        function initCounter() {
          for (const key in row) {
            oneCount[key] = {
              include: true,
              spaceCount: 0,
              maxDate: undefined,
              minDate: undefined,
              dateCount: 0,
              maxNumber: undefined,
              totalNumber: 0,
              minNumber: undefined,
              numberCount: 0,
              maxString: undefined,
              minString: undefined,
              numberStringCount: 0,
            };
          }
        }
        if (isEndOfFile) return;
        if (!isFiltered) return;
        if (filteredRowCounts == 1) initCounter();

        function getMin(currentValue, value) {
          if (currentValue == undefined) return value;
          if (currentValue > value) return value;
          return currentValue;
        }

        function getMax(currentValue, value) {
          if (currentValue == undefined) return value;
          if (currentValue < value) return value;
          return currentValue;
        }

        for (const [key, value] of Object.entries(row)) {
          const item = value.trim();
          const count = oneCount[key];
          if (item == "") {
            count.spaceCount++;
            continue;
          }
          if (_.isValidDate(item)) {
            count.maxDate = getMax(count.maxDate, item);
            count.minDate = getMin(count.minDate, item);
            count.dateCount++;
            continue;
          }
          if (!isNaN(item)) {
            const n = Number(item);
            count.maxNumber = getMax(count.maxNumber, n);
            count.minNumber = getMin(count.minNumber, n);
            count.totalNumber += n;
            count.numberCount++;
            continue;
          }
          count.maxString = getMax(count.maxString, item);
          count.minString = getMin(count.minString, item);
          count.stringCount++;
        }
      }
      function countPlan(key, oneCount, isFiltered) {
        if (isEndOfFile) return;
        if (!isFiltered) return;
        if (!includeRowInChart(key, row)) return;

        const {
          descriptionCol,
          startDateCol,
          endDateCol,
          secondStartDateCol,
          secondEndDateCol,
          ragCol,
        } = getChartProps(key);

        function createOthers(start, end, secondStartDate, secondEndDate, rag) {
          if (!oneCount[DISPLAY_OTHERS])
            oneCount[DISPLAY_OTHERS] = {
              include: true,
              start,
              end,
              secondStartDate,
              secondEndDate,
              rag: undefined,
            };

          const others = oneCount[DISPLAY_OTHERS];
          if (others.start > start) others.start = start;
          if (others.end < end) others.end = end;
          if (others.secondStartDate > secondStartDate)
            others.secondStartDate = secondStartDate;
          if (others.secondEndDate < secondEndDate)
            others.secondEndDate = secondEndDate;
        }
        const desc = row[descriptionCol];
        if (!oneCount[desc]) oneCount[desc] = { include: true };
        const start = row[startDateCol];
        const end = row[endDateCol];
        const secondStartDate = row[secondStartDateCol];
        const secondEndDate = row[secondEndDateCol];
        const rag = row[ragCol];
        let errorFound = false;
        if (!isValidData(start, "date", "First start", key)) errorFound = true;
        if (!isValidData(end, "date", "First end", key)) errorFound = true;

        if (start > end) {
          log(`Start > end`, key);
          errorFound = true;
        }
        if (secondStartDate)
          if (!isValidData(secondStartDate, "date", "Second start", key))
            errorFound = true;
        if (secondEndDate)
          if (!isValidData(secondEndDate, "date", "Second end", key))
            errorFound = true;

        if (secondStartDate && secondEndDate) {
          if (secondStartDate > secondEndDate) {
            log(`Second start > end`, key);
            errorFound = true;
          }
        }
        if (secondStartDate && !secondEndDate) {
          log(`Second start but no end`, key);
          errorFound = true;
        }
        if (!secondStartDate && secondEndDate) {
          log(`Second end but no start`, key);
          errorFound = true;
        }

        if (errorFound) return;

        if (Object.keys(oneCount).length > 30) {
          createOthers(start, end, secondStartDate, secondEndDate, rag);
          return;
        }
        Object.assign(oneCount[desc], {
          start,
          end,
          secondStartDate,
          secondEndDate,
          rag,
        });
      }
      function countTrend(key, oneCount, isFiltered) {
        const chartProp = getChartProps(key);
        const {
          chartType,
          trendStartDate,
          x_column, //for Trend
          openDateCol, //for Trend OC, same as x_column???
          closeDateCol, //for Trend OC, rename as x_column_2???
          forecast,
          plan,
        } = chartProp;
        if (isStartOfFile) init();
        const memo = allCounts.memo[key];
        if (isEndOfFile) {
          memo.totalRowCounts = totalRowCounts;
          memo.filteredRowCounts = filteredRowCounts;
          return;
        }

        if (!isFiltered) return;
        if (!includeRowInChart(key, row)) return;
        updateCounter();

        function init() {
          if (!allCounts.memo[key]) allCounts.memo[key] = {};
          const memo = allCounts.memo[key];
          const { reportDate } = config;
          Object.assign(memo, {
            reportDate,
            count: 0,
            open: 0,
            close: 0,
          });
          const trendEndDate = getMaxDate();
          const dateRange = getOrderedValues("Trend", chartProp, trendEndDate);
          dateRange.forEach(
            (v) =>
              (oneCount[v] = {
                include: true,
                open: 0,
                close: 0,
                count: 0,
              })
          );
          initForecast(forecast, memo);
          function getMaxDate() {
            const updateMax = (chartProp) => {
              if (!chartProp) return;
              const colMaxDate =
                allCounts.memo.dataDescription[chartProp].maxDate;
              if (maxDate < colMaxDate) maxDate = colMaxDate;
            };
            // const { reportDate } = config
            const { reportDate } = memo;
            let maxDate = reportDate;
            updateMax(openDateCol);
            updateMax(closeDateCol);
            updateMax(x_column);
            // get plan end date as well?
            return maxDate;
          }
        }
        function initForecast(forecast, memo) {
          const forecastObj = getParsedValue("forecast", forecast); //_.parse(forecast);
          if (!forecastObj) return;
          const { lookBack } = forecastObj; //output;
          if (!lookBack) return;
          if (!allCounts.memo[key]) allCounts.memo[key] = {};
          const { reportDate } = config;
          const cutoffDate = _.addDays(reportDate, -(lookBack - 1));

          memo.forecast = {
            ...forecastObj,
            count: 0,
            open: 0,
            close: 0,
            lookBackValues: new Array(lookBack).fill(0),
            cutoffDate,
          };
        }
        function updateCounter() {
          if (chartType == "Trend OC") updateOpenClose();
          else updateNormal();

          return true;
          function getNearestMatchingDate(date) {
            for (const d in oneCount) {
              if (date <= d) return d;
            }
            return;
          }
          function updateNormal() {
            const date = row[x_column];
            updateCounters({ date, dateError: "Date", count: 1 });
          }

          function updateOpenClose() {
            const openDate = row[openDateCol];
            updateCounters({
              date: openDate,
              dateError: "Open date",
              openCount: 1,
            });
            const closeDate = row[closeDateCol];
            const isClosed = closeDate.trim() !== "";
            if (isClosed)
              updateCounters({
                date: closeDate,
                dateError: "Close date",
                closeCount: 1,
              });
          }
          function updateCounters({
            date,
            count = 0,
            openCount = 0,
            closeCount = 0,
            dateError = "Date",
          }) {
            if (!isValidData(date, "date", dateError, key)) return;
            const chartDate = getNearestMatchingDate(date);
            const dateCount = oneCount[chartDate];
            if (!dateCount) console.log({ oneCount, date, chartDate });
            dateCount.count += count;
            dateCount.open += openCount;
            dateCount.close += closeCount;
            updateForecast({
              date,
              count: count ? count : openCount - closeCount,
              openCount,
              closeCount,
            });
          }
          function updateForecast({
            date,
            count = 0,
            openCount = 0,
            closeCount = 0,
          }) {
            const forecast = allCounts.memo[key].forecast;
            if (!forecast) return;
            const { cutoffDate } = forecast;
            const dateDiff = _.dateTimeDiff(cutoffDate, date) - 1;
            if (dateDiff >= 0) {
              forecast.count += count;
              forecast.open += openCount;
              forecast.close += closeCount;
              forecast.lookBackValues[dateDiff] += count;
            }
          }
        }
      }
      function update2X2Counts(
        count,
        x,
        y,
        { totalSum = 0, filteredSum = 0, totalCount = 0, filteredCount = 0 }
      ) {
        let xy = x + "|" + y;
        if (!count[xy]) {
          const isTooMany = Object.keys(count).length >= 100;
          if (isTooMany) xy = DISPLAY_OTHERS;
          count[xy] = {
            include: true,
            totalSum: 0,
            filteredSum: 0,
            totalCount: 0,
            filteredCount: 0,
            x: isTooMany ? "<OTHERS>" : x,
            y: isTooMany ? "<OTHERS>" : y,
          };
        }

        count[xy].totalSum += totalSum;
        count[xy].filteredSum += filteredSum;
        count[xy].totalCount += totalCount;
        count[xy].filteredCount += filteredCount;
      }
      function countStateChange(key, oneCount, filtered) {
        //to do make <now> as a parameter
        const { reportDate } = config;
        const { idCol, x_column, y_column, timestampCol } = getChartProps(key);
        if (totalRowCounts === 1) {
          oneCount[SYMBOL_PREV_STATE] = {};
          readyPrevious({});
          if (hasFilter(x_column)) console.log(`Filter: ${x_column}`);
          if (hasFilter(y_column)) console.log(`Filter: ${y_column}`);
          if (hasFilter(timestampCol)) console.log(`Filter: ${timestampCol}`);
        }
        const prev = oneCount[SYMBOL_PREV_STATE];
        if (isEndOfFile) {
          calculatePrevious();
          delete oneCount[SYMBOL_PREV_STATE];
          return;
        }
        if (!filtered) return;
        if (!includeRowInChart(key, row)) return;

        const id = row[idCol].trim();
        const to = row[x_column].trim();
        const from = row[y_column].trim();
        let timestamp = row[timestampCol];

        if (!isValidData(timestamp, "date", "Timestamp", key)) timestamp = 0;

        // if (prev.id && id < prev.id)
        //     log(`Id not in ascending order ${id} ${prev.id}`, key)

        if (id !== prev.id) calculatePrevious();
        else calculateCurrent();
        readyPrevious({ id, to, from, timestamp });

        function readyPrevious({ id = "", to = "", from = "", timestamp = 0 }) {
          const prev = oneCount[SYMBOL_PREV_STATE];
          Object.assign(prev, { id, to, from, timestamp });
        }
        function calculatePrevious() {
          // const prev = oneCount[SYMBOL_PREV_STATE]
          if (prev.to !== "") {
            const delta = _.dateTimeDiff(prev.timestamp, reportDate, "Days");
            if (delta < 0) log(`Timestamp not in ascending order`, key);
            update2X2Counts(oneCount, "<Now>", prev.to, {
              filteredCount: 1,
              filteredSum: delta,
            });
          }
        }
        function calculateCurrent() {
          if (prev.to) {
            if (prev.to !== from) log(`"from" not same as previous "to"`, key);
            const delta = _.dateTimeDiff(prev.timestamp, timestamp, "Days");
            update2X2Counts(oneCount, to, from, {
              filteredCount: 1,
              filteredSum: delta,
            });
            if (delta < 0) log(`Timestamp not in ascending order`, key);
          }
        }
      }
      function count2X2(key, oneCount, isFiltered) {
        if (isEndOfFile) {
          return;
        }
        if (!includeRowInChart(key, row)) return;
        const { colOver, x_column, y_column } = getChartProps(key);

        const sum = getSumValue(key, colOver);

        update2X2Counts(oneCount, row[x_column], row[y_column], {
          totalSum: !isFiltered ? sum : 0,
          filteredSum: isFiltered ? sum : 0,
          totalCount: !isFiltered ? 1 : 0,
          filteredCount: isFiltered ? 1 : 0,
        });
      }
      function risk(key, oneCount, isFiltered) {
        if (isEndOfFile) {
          console.log({ oneCount });
          return;
        }
        if (isStartOfFile) {
          const { x_labels, y_labels } = getChartProps(key);
          const x_map = _.toMap(_.getArray(x_labels));
          const y_map = _.toMap(_.getArray(y_labels));
          allCounts.memo[key] = { x_map, y_map };
        }
        const memo = allCounts.memo[key];
        const { x_map, y_map } = memo;
        if (!includeRowInChart(key, row)) return;
        const { colOver, x_column, y_column } = getChartProps(key);
        const sum = getSumValue(key, colOver);
        update2X2Counts(
          oneCount,
          x_map.get(row[x_column].trim()),
          y_map.get(row[y_column].trim()),
          {
            // update2X2Counts(oneCount, row[x_column], row[y_column], {
            totalSum: !isFiltered ? sum : 0,
            filteredSum: isFiltered ? sum : 0,
            totalCount: !isFiltered ? 1 : 0,
            filteredCount: isFiltered ? 1 : 0,
          }
        );
      }
      function countBar(key, oneCount, isFiltered) {
        const {
          countType,
          colOver,
          x_column,
          x_dataType,
          x_bin,
          x_labels,
          x_dateFormat,
          x_separator,
        } = getChartProps(key);
        // if (totalRowCounts === 1 && !isFiltered) init()
        if (isStartOfFile) init();
        const memo = allCounts.memo[key];

        if (isEndOfFile) {
          //console.log(key, memo)
          wrapUp();
          return;
        }
        if (!isValidData(row[x_column], "any", x_column, key)) return;
        updateCounts();

        function wrapUp() {}
        function init() {
          if (!allCounts.memo[key]) allCounts.memo[key] = {};
          const memo = allCounts.memo[key];
          if (x_bin) {
            const binCount = Number(x_bin.trim());
            if (isNaN(binCount)) memo.bin = _.cleanArray(x_bin, "Number");
            else {
              const { maxNumber, minNumber } =
                allCounts.memo["dataDescription"][x_column];
              const max = Math.round(maxNumber);
              const min = Math.floor(minNumber);
              const rawStep = (max - min) / (binCount + 1);
              if (rawStep < 10) {
                memo.bin = [min, max];
              } else {
                const step = Math.round(rawStep);
                memo.bin = [min];
                for (let i = 1; i < binCount; i++)
                  memo.bin.push(min + i * step);
                memo.bin.push(max);
              }
            }
          }
          if (x_labels) memo.order = x_labels;
          if (x_dateFormat) {
            memo.dateFormat = x_dateFormat;
            memo.reportDate = config.reportDate;
          }
          if (x_separator) memo.separator = x_separator;
          return memo;
        }
        function updateCounts() {
          if (!oneCount) oneCount = {};
          const maxCats = 2 * MAX_BAR_CATS;
          const v = dataTypes[x_dataType].getFormattedValue(
            row[x_column],
            memo
          );

          if (x_dataType == "List Members") {
            if (Array.isArray(v)) v.forEach((lm) => countAValue(lm));
            rowForFilter[key] = undefined;
            return;
          }

          rowForFilter[key] = countAValue(v);

          function countAValue(originalCat) {
            const cat = oneCount[originalCat]
              ? originalCat
              : Object.keys(oneCount).length < maxCats
              ? originalCat
              : SYMBOL_OTHERS; //DISPLAY //_OTHERS

            if (cat === SYMBOL_OTHERS)
              //_OTHERS)
              log(`Over ${maxCats} categories`, key);

            if (!oneCount[cat])
              oneCount[cat] = {
                include: true, // true mean include in counts
                totalSum: 0, // if sum/ave then sum without filter
                filteredSum: 0, // if sum/ave then sum when filtered
                totalCount: 0, // count without filter
                filteredCount: 0, // count when filtered
              };
            if (includeRowInChart(key, row)) {
              const sum = getSumValue(key, colOver);
              if (!isFiltered) {
                oneCount[cat].totalCount++;
                oneCount[cat].totalSum += sum;
              }
              if (isFiltered) {
                oneCount[cat].filteredCount++;
                oneCount[cat].filteredSum += sum;
              }
            }
            return cat;
          }
        }
      }
      function countBasedOnType(key, isFiltered) {
        const oneCount = allCounts.counts[key];
        const { chartType } = getChartProps(key);
        switch (chartType) {
          case "Bar":
            countBar(key, oneCount, isFiltered);
            break;
          case "Data Description":
            countDataDescription(key, oneCount, isFiltered);
            break;
          case "Data Table":
            countTable(key, oneCount, isFiltered);
            break;
          case "Note":
            break;
          case "Plan":
            countPlan(key, oneCount, isFiltered);
            break;
          case "Risk":
            risk(key, oneCount, isFiltered);
            break;
          case "2X2":
            count2X2(key, oneCount, isFiltered);
            break;
          case "State Change":
            countStateChange(key, oneCount, isFiltered);
            break;
          case "Trend":
          case "Trend OC":
            countTrend(key, oneCount, isFiltered);
            break;
          case "Banner":
            break;
          default:
            console.error(`Invalid chartType: ${chartType}`);
        }
      }
    }
    function wrapUp(allCounts) {
      countRecords(allCounts);
      makeChartData(allCounts, config);
      makeCallOuts(allCounts, config);
    }
    function getChartProps(index) {
      if (!config.chartProperties[index]) {
        log(
          `Invalid call to getChartProps; index= ${index}`,
          undefined,
          "error"
        );
        return;
      }
      return config.chartProperties[index];
    }
    function zeroCounters(allCounts) {
      for (const key in allCounts.counts) {
        const { chartType } = getChartProps(key);

        if (["2X2", "Risk", "Bar"].includes(chartType)) {
          for (const v of Object.values(allCounts.counts[key])) {
            v.totalSum = 0;
            v.filteredSum = 0;
            v.totalCount = 0;
            v.filteredCount = 0;
          }
          continue;
        }
        if (["Trend", "Trend OC"].includes(chartType)) {
          for (const v of Object.values(allCounts.counts[key])) {
            v.open = 0;
            v.close = 0;
            v.count = 0;
          }
          continue;
        }
        allCounts.counts[key] = {};
      }
    }
    function clearLog() {
      for (const key in allCounts.memo)
        if (allCounts.memo[key].log) delete allCounts.memo[key].log;
    }
    function log(message, key, severity = "warning") {
      logMessage(message, severity, key, allCounts, filteredRowCounts);
    }
    function gatherDataDescription(row, descriptions) {
      function initCounter() {
        for (const key in row)
          descriptions[key] = {
            spaceCount: 0,
            maxDate: undefined,
            minDate: undefined,
            dateCount: 0,
            maxNumber: undefined,
            minNumber: undefined,
            numberCount: 0,
            maxString: undefined,
            minString: undefined,
            stringCount: 0,
          };
      }

      if (_.isEmptyObject(descriptions)) initCounter();

      function getMin(currentValue, value) {
        if (currentValue == undefined) return value;
        if (currentValue > value) return value;
        return currentValue;
      }

      function getMax(currentValue, value) {
        if (currentValue == undefined) return value;
        if (currentValue < value) return value;
        return currentValue;
      }

      for (const [key, value] of Object.entries(row)) {
        const item = value.trim();
        const description = descriptions[key];

        if (item == "") {
          description.spaceCount++;
          continue;
        }
        if (_.isValidDate(item)) {
          description.maxDate = getMax(description.maxDate, item);
          description.minDate = getMin(description.minDate, item);
          description.dateCount++;
          continue;
        }
        if (!isNaN(item)) {
          description.maxNumber = getMax(description.maxNumber, Number(item));
          description.minNumber = getMin(description.minNumber, Number(item));
          description.numberCount++;
          continue;
        }
        description.maxString = getMax(description.maxString, item);
        description.minString = getMin(description.minString, item);
        description.stringCount++;
      }
    }
    function cleanRow(uncleanRow, presetOffsetDays) {
      const modifiedDate = (date) => {
        const newDate = presetOffsetDays
          ? _.addDays(date, presetOffsetDays)
          : date;
        return _.formatDate(newDate, "YYYY-MM-DD");
      };
      const row = {};
      for (const key in uncleanRow) {
        const cell = uncleanRow[key].trim();
        if (_.isValidDate(cell)) row[key] = modifiedDate(cell);
        else row[key] = cell;
      }
      return row;
    }
    async function passOne(file, presetOffsetDays, preview) {
      dataDescription = {};
      const p = await readCSV(
        // preview,
        { complete: true },
        {
          file,
          step: (row) => {
            const cleanedRow = cleanRow(row.data, presetOffsetDays);
            gatherDataDescription(cleanedRow, dataDescription);
          },
          //error: (err, file) => console.error({ err, file }),
          complete: (result, file) => {
            //resolve(true)
          },
        }
      );
      if (p.complete) return;
      fileError = p;
    }
    function includeRowInChart(key, row) {
      init();
      if (allCounts.memo[key]?.chartFilter) return filterAction();
      return true;

      function init() {
        if (allCounts.memo[key] && allCounts.memo[key].chartFilter) return;
        const { chartFilter } = getChartProps(key);

        if (!_.isPresent(chartFilter)) return;

        if (!allCounts.memo[key]) allCounts.memo[key] = {};
        allCounts.memo[key].chartFilter = _.toRows(chartFilter, 4);
      }
      function filterAction() {
        if (!allCounts.memo[key]) return;
        const { chartFilter } = allCounts.memo[key];
        let whereConditionMet = true;
        const results = chartFilter.map((condition) => {
          const [join, columnName, op, operand] = condition;
          return { met: getConditionResult({ columnName, op, operand }), join };
        });
        for (let i = 0; i < results.length; i++) {
          const { met, join } = results[i];
          if (i === 0) whereConditionMet = met;
          else {
            if (join === "and") whereConditionMet &&= met;
            else whereConditionMet ||= met;
          }

          // const met = where.reduce((result, consition)=>
        }
        // let prevOp = "and";
        // for (let i = 0; i < where.length; i++) {
        //   const hasMet = getConditionResult(where[i]);
        //   whereConditionMet =
        //     prevOp === "and"
        //       ? whereConditionMet && hasMet
        //       : whereConditionMet || hasMet;
        //   if (i < where.length) {
        //     prevOp = where[i + 1];
        //     i++;
        //   }
        // }
        return whereConditionMet;

        function getConditionResult({ columnName, op, operand }) {
          if (!columnName) {
            log(`Chart filter column name invalid`, key);
            return true;
          }
          const value = row[columnName];
          if (value == undefined) {
            log(`Chart filter column: (${columnName}) invalid`, key);
            return true;
          }
          if (!op) {
            log(`Chart filter op invalid`, key);
            return true;
          }
          if (!operand) {
            log(`Chart filter operand invalid`, key);
            return true;
          }
          //TO DO reintroduce?  log(`Some rows skipped due to 'chart filter' in the chart`, key,"info")
          const compareAsNumbers = op.includes("(n)");
          const columnValue = compareAsNumbers
            ? Number(value)
            : value.toLowerCase();

          const target = compareAsNumbers
            ? Number(operand)
            : operand.toLowerCase();

          if (op.startsWith("eq")) return columnValue === target;
          if (op.startsWith("neq")) return columnValue !== target;
          if (op === "in") return (target + "").includes("" + columnValue);
          if (op === "nin") return !(target + "").includes("" + columnValue);
          log(`Chart filter op invalid`, key);
          return false;
          // const isEq = compareAsNumbers ? isEqual("number") : isEqual();
          // return op === "eq" || op === "eq(n)" ? isEq : !isEq;

          // function isEqual(type) {
          //   const val = (x) =>
          //     type === "number" ? Number(x) : x.toLowerCase();
          //   const compareVal = val(value);

          //   if (typeof operand === "string") return val(operand) === compareVal;
          //   const found =
          //     operand.findIndex((v) => val(v) === compareVal) !== -1;
          //   return found;
          // }
        }
      }
    }

    function cannotFilter(chartType) {
      if (!chartType) return false;
      if (!chartTypes[chartType]) return false;
      if (!chartTypes[chartType].cannotFilter) return false;
      return chartTypes[chartType].cannotFilter;
    }
    function isValidData(value, dataType, prefix, key = "global") {
      if (value == undefined) {
        log(`Column: "${prefix}" missing`, key, "error");
        return false;
      }

      if (typeof dataType !== "string") {
        log(`Data type not string`, key, "error");
        return false;
      }

      const dataTypeTlc = dataType.trim().toLowerCase();
      if (dataTypeTlc == "number")
        if (isNaN(value)) {
          log(`${prefix} is ${DISPLAY_INVALID_NUMBER}`, key);
          return false;
        }
      if (dataTypeTlc == "date")
        if (!_.isValidDate(value)) {
          log(`${prefix} is ${DISPLAY_INVALID_DATE}`, key);
          return false;
        }
      return true;
    }
  }

  function validateChart(chartType, properties, config) {
    const error = {
      isValid: false,
      errors: { chartType: "Invalid chart type" },
    };
    if (!chartType) return error;
    if (!chartTypes[chartType]) return error;
    if (!chartTypes[chartType].validate) return { isValid: true };
    return chartTypes[chartType].validate(properties, config);
  }
  function validateCallout(chartType, properties, config) {
    const error = {
      isValid: false,
      errors: {
        chartType: "No callout for this chart type",
      },
    };
    if (!chartType) return error;
    if (!chartTypes[chartType]) return error;
    if (!chartTypes[chartType].validateCallout) return error;
    return chartTypes[chartType].validateCallout(properties, config);
  }
  /////////// chartTypes functions
  function getChartDescription() {
    const chartDescription = {};
    for (const key in chartTypes) {
      chartDescription[key] = {
        cannotFilter: chartTypes[key].cannotFilter,
        isChart: true,
      };
    }
    chartDescription.dateFormats = dataTypes["Date"].formats;
    return chartDescription;
  }
  function getChartDataTypes() {
    return JSON.stringify({ dataTypes, chartTypes });
  }
  //////////////////////////////////////chartTypes functions
  function logMessage(message, severity, key, allCounts, filteredRowCounts) {
    if (!allCounts.memo[key]) allCounts.memo[key] = {};
    const memo = allCounts.memo[key];
    if (!memo.log) memo.log = {};
    const memoLog = memo.log;
    if (!memoLog[message]) {
      memoLog[message] = { first: filteredRowCounts, count: 0 };
    }
    const ml = memoLog[message];
    ml.severity = severity;
    ml.last = filteredRowCounts;
    ml.count++;
  }
  function makeChartData(allCounts, config) {
    allCounts.data = {};
    for (let i = 0; i < config.chartProperties.length; i++) {
      allCounts.data[i] = dataForChart(i);
    }

    function dataForChart(i) {
      const oneCount = allCounts.counts[i];
      const oneConfig = config.chartProperties[i];
      const memo = allCounts.memo[i];
      const { countType, chartType } = oneConfig;
      if (chartType === "Note") return;
      if (chartType === "Bar") {
        // x_sortOn : category | value, x_sortOrder: ascending | descending
        //available only for dataType = String or number without bin
        const { x_dataType } = oneConfig;
        const cats = memo ? dataTypes[x_dataType].getCategories(memo) : [];

        const specialCats = [
          DISPLAY_SPACES,
          DISPLAY_INVALID_DATE,
          DISPLAY_INVALID_NUMBER,
          SYMBOL_OTHERS,
        ];

        const mustCats = cats.map((v) => {
          const count = oneCount[v] ? oneCount[v].filteredCount : 0;
          const sum = oneCount[v] ? oneCount[v].filteredSum : 0;
          return { x: v, count, sum };
        });
        const specials = specialCats
          .map((v) => {
            const includeInCount = (v) => {
              if (!oneCount[v]) return false;
              if (oneCount[v].totalCount == 0) return false;
              return true;
            };
            const count = includeInCount(v) ? oneCount[v].filteredCount : 0;
            const sum = includeInCount(v) ? oneCount[v].filteredSum : 0;
            return { x: symbolToDisplay(v), count, sum };
          })
          .filter((v) => v.count > 0);

        const optionals = Object.keys(oneCount)
          .filter((v) => !(specialCats.includes(v) || cats.includes(v)))
          .map((v, i) => {
            const count = oneCount[v].filteredCount;
            const sum = oneCount[v].filteredSum;
            const totalCount = oneCount[v].totalCount;
            const totalSum = oneCount[v].totalSum;
            return { x: v, count, sum, totalCount, totalSum };
          });

        const { x_sortOn = "v", x_sortOrder = "a" } = oneConfig; //TODO parametrise ths

        const getSortKey = () => {
          if (x_sortOn === undefined || x_sortOn === "none" || x_sortOn === "")
            return "";
          if (x_sortOn === "cat") return "x";
          if (countType === "Count") return "totalCount";
          if (countType === "Sum") return "totalSum";
          return (d) => (d.totalCount > 0 ? d.totalSum / d.totalCount : 0);
        };

        const sortKey = getSortKey();

        const sortedOptionals =
          sortKey === ""
            ? [...optionals]
            : _.sortArrayOrObjects(optionals, {
                key: sortKey,
                order: x_sortOrder,
              });

        const optionalCount = sortedOptionals.length;

        const maxOptionals = MAX_BAR_CATS - (cats.length + specials.length);

        if (optionalCount > maxOptionals) {
          const others = { x: DISPLAY_OTHERS, count: 0, sum: 0 };
          const countToRemove = optionalCount - maxOptionals;
          let countOfRemoved = 0;

          for (let i = optionalCount - 1; i >= 0; i--) {
            const so = sortedOptionals[i];
            if (countOfRemoved >= countToRemove) break;
            others.count += so.count;
            others.sum += so.sum;
            countOfRemoved++;
            so.remove = true;
          }
          // console.log(sortedOptionals)
          //update the others
          const othersInSpecialsIndex = specials.findIndex(
            (v) => v.x === DISPLAY_OTHERS
          );
          if (othersInSpecialsIndex != -1) {
            const existingOthers = specials[othersInSpecialsIndex];
            // console.log(others, existingOthers)
            existingOthers.count += others.count;
            existingOthers.sum += others.sum;
            // console.log(existingOthers)
          } else specials.push(others);
        }

        const data = [
          ...mustCats,
          ...sortedOptionals.filter((v) => !v.remove),
          ...specials,
        ].map((d) => {
          return { x: d.x, v: getDisplayValue(countType, d) };
        });
        return { data };
      }

      if (chartType == "Data Table") {
        const data = [],
          labels = [];

        for (const key in oneCount) {
          labels.push(key);
          data.push({ "#": key, ...oneCount[key].filteredValue });
        }
        return { labels, data };
      }
      if (chartType == "Data Description") {
        let data = [],
          labels = [];
        const headers = {
          spaceCount: "Spaces: #",
          stringCount: "Strings: #",
          maxString: "String: Max",
          minString: "String: Min",
          dateCount: "Date: #",
          maxDate: "Date: Max",
          minDate: "Date: Min",
          numberCount: "Number: #",
          maxNumber: "Number: Max",
          minNumber: "Number: Min",
        };

        for (const head of Object.keys(headers)) {
          const entry = {};
          entry["Attributes"] = headers[head];
          for (const key of Object.keys(oneCount)) {
            entry[key] = oneCount[key][head] ?? "";
          }
          data.push(entry);
          labels.push(i++);
        }
        return { labels, data };
      }
      if (chartType == "2X2" || chartType == "State Change") {
        const { x_labels, y_labels, countLabels } = oneConfig;

        const data = Object.keys(oneCount).map((key) => ({
          x: oneCount[key].x,
          y: oneCount[key].y,
          // ...oneCount[v],
          // fill: fill(displayValue(key)),
          v: getDisplayValue(countType, oneCount[key]),
        }));
        const extent = d3Extent(data, (d) => d.v);
        const xDomain = x_labels ? _.getArray(x_labels) : [];
        const yDomain = y_labels ? _.getArray(y_labels) : [];
        const countDomain = _.getArray(countLabels);
        data.forEach((v) => {
          if (!xDomain.includes(v.x)) xDomain.push(v.x);
          if (!yDomain.includes(v.y)) yDomain.push(v.y);
          v.fill = fill(v.v);
        });
        const domain = { countDomain, xDomain, yDomain };
        return { domain, data };

        function fill(d) {
          const min = extent[0];
          const step = (extent[1] - min) / (countDomain.length - 1);
          const index = Math.floor((d - min) / step);
          return countDomain[index];
        }
      }
      if (chartType == "Risk") {
        const { countLabels } = oneConfig;
        const { x_map, y_map } = memo;
        const xDomain = [...x_map.values()];
        const yDomain = [...y_map.values()];
        const countDomain = _.getArray(countLabels);

        const val = (x, map) => {
          let i = 0;
          for (const val of map.values()) {
            if (val === x) return i;
            i++;
          }
          return 5;
        };

        const colorValue = (count) => {
          const value = val(count.x, x_map) * val(count.y, y_map);
          if (value <= 2) return countDomain[0];
          if (value <= 6) return countDomain[1];
          if (value <= 12) return countDomain[2];
          if (value <= 16) return countDomain[3];
          return countDomain[4];
        };
        const data = Object.keys(oneCount).map((key) => ({
          x: oneCount[key].x,
          y: oneCount[key].y,
          fill: colorValue(oneCount[key]),
          v: getDisplayValue(countType, oneCount[key]),
        }));
        const domain = {
          countDomain,
          xDomain,
          yDomain: yDomain.reverse(),
        };
        return { domain, data };
      }
      if (chartType == "Plan") {
        return { labels: [], data: oneCount };
      }
      if (chartType == "Trend OC" || chartType == "Trend") {
        const { x_label } = oneConfig;
        const isCumulative = true;
        let cumulativeCount = 0;
        const data = Object.keys(oneCount).map((date) => {
          const count =
            chartType === "Trend OC"
              ? oneCount[date].open - oneCount[date].close
              : oneCount[date].count;
          cumulativeCount += count;
          return {
            x: new Date(date),
            v: isCumulative ? cumulativeCount : count,
            type: x_label,
          };
        });
        const domain = { timeline: x_label };
        addPlan(data);
        addForecast(data);
        return { domain, data };

        function addPlan(plotData) {
          const { plan } = oneConfig;
          const planObj = getParsedValue("plan", plan);
          if (!planObj) return;
          const { startDate, endDate, scopeFrom, scopeTo, points, label } =
            planObj;

          const to = scopeTo === "max" ? memo.filteredRowCounts : scopeTo;
          const deltaScope = to - scopeFrom;
          const dateSteps =
            _.dateTimeDiff(startDate, endDate, "Days") / (points.length - 1);
          for (let i = 0; i < points.length; i++) {
            // console.log(Math.round(i * dateSteps))
            const x = _.addDays(startDate, Math.round(i * dateSteps));
            const v = Math.round(scopeFrom + deltaScope * points[i]);
            plotData.push({ x, v, type: label });
          }
          domain.plan = label;
        }
        function addForecast(plotData) {
          //forecast
          if (!memo) return;
          if (!memo.forecast) return;
          const {
            count,
            lookBack,
            lookBackValues,
            cutoffDate,
            forecastTo,
            label,
          } = memo.forecast;

          if (lookBack <= 0) return;

          let slope = count / lookBack;
          // const intercept = value - slope * valueAtPoint // the point matches actual
          // const intercept = (cumSum -count) - slope * 0 //first point matches actual
          const intercept =
            cumulativeCount - slope * (lookBackValues.length - 1); //last point matches actual
          // const intercept =
          //     cumSum - count / 2 - (slope * (lookBackValues.length - 1)) / 2 //mid point matches actual
          const { filteredRowCounts } = memo;
          const linear = { slope, intercept };

          const forecastStart = {
            x: new Date(cutoffDate),
            v: cumulativeCount - count,
            type: label,
          };
          const endX = getX(filteredRowCounts, linear);
          let endXModified = endX;
          const fallback = 100;
          if (endX > 0 && endX > fallback) {
            logMessage(
              `Forecast limited to ${fallback} days`,
              "warning",
              i,
              allCounts,
              0
            );
            endXModified = fallback;
          }
          const endPoint = () => {
            const endDate =
              forecastTo === "max"
                ? _.addDays(cutoffDate, endXModified)
                : _.isValidDate(forecastTo)
                ? forecastTo
                : _.addDays(cutoffDate, forecastTo);

            const endCount =
              forecastTo === "max"
                ? filteredRowCounts
                : getY(_.dateTimeDiff(cutoffDate, endDate), linear);

            return {
              x: new Date(endDate),
              v: Math.round(endCount),
              type: label,
            };
          };

          plotData.push(forecastStart);
          plotData.push(endPoint());

          domain.forecast = label;
          function getY(x, { intercept, slope }) {
            return intercept + slope * x;
          }
          //TODO check if the forecast end is too far away
          function getX(y, { intercept, slope }) {
            const delta = y - intercept;
            if (slope === 0) return delta > 0 ? Infinity : -Infinity;
            const x = delta / slope;
            return x;
          }
        }
      }
    }
  }
  function makeCallOuts(allCounts, config) {
    allCounts.callouts = {};
    // const charts = config.chartProperties
    const { callouts } = config;
    if (!callouts) return;
    for (let i = 0; i < callouts.length; i++) {
      const error = (bottom) => {
        allCounts.callouts[i] = { top: "ERR", bottom };
      };
      const chartNumber = callouts[i].chartNumber;
      if (chartNumber === undefined) {
        error(`Chart number missing`);
        continue;
      }
      const chartProperties = config.chartProperties[chartNumber];
      if (!chartProperties) {
        error(`No chart for chart number: ${chartNumber}`);
        continue;
      }
      const { chartType } = chartProperties;
      if (!chartType) {
        error(`No chart type for chart number: ${chartNumber}`);
        continue;
      }

      const getCallout = chartTypes[chartType].getCallout;
      if (!getCallout) {
        error(`No callout for chart type: ${chartType}`);
        continue;
      }
      const data = allCounts.data[chartNumber]?.data;
      const { top, bottom } = getCallout(
        config.callouts[i],
        chartProperties,
        data
      );
      allCounts.callouts[i] = { chartNumber, top, bottom };
    }
  }
  return {
    getFirstRecord, // required?
    getCountsFromFile, //getCounts
    //charts and callouts - move to separate file?
    getChartDataTypes, //
    getChartDescription, //
    // validateChart,
    validateCallout,
  };
})();

//export $p

//////////////////////////////////////////////////// allCounts current
// allCounts =  {memo, counts}
// memo = {dataDescription, {0: value}, {1: value}, ...}
// counts = {0: oneCount, 1: oneCount, ...}
// oneCount =
// {
//      cat1: {
//          include: true|false,
//          totalSumV: sum of column over without filter
//          filteredSum: sum of column over with filter
//          totalCount: count of records without filter
//          filteredCount: count of records with filter
//      }
//      cat2: {...},
//      ....
// }

//////////////////////////////////////////////////// allCounts proposed
// counts =  {global: memoCount, 0: memoCount, 1: memoCount, ...}
// memoCount = {memo: {}, count: oneCount}
// oneCount =
// {
//      cat1: {
//          include: true|false,
//          totalSumV: sum of column over without filter
//          filteredSum: sum of column over with filter
//          totalCount: count of records without filter
//          filteredCount: count of records with filter
//      }
//      cat2: {...},
//      ....
// }

///////////////////////////////////////////////////// remove $p comments

///////////////////////////////////////////////////////////// values in memo
// dataDescription (filtered and raw)
//  chartType   types of data in memo
//  trend       forecast, start, end
//  number      bin
//  date
//
