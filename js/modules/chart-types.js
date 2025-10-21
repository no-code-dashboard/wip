//19-jul labels added to elements
"use strict";
import { extent as d3Extent } from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { _ } from "./util.js";
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
import { Dialog } from "./dialog.js";
// import { configChart } from "./dialog-use.js";
// import { dataTypes } from "./data-types.js";
export {
  chartTypes,
  noChart,
  getCalloutOverlay,
  validateChart,
  validateCallout,
  getParsedValue,
};

const SHOW = { attrs: ["class", "hide", "remove"], applyToWrapper: true };
const HIDE = { attrs: ["class", "hide", "add"], applyToWrapper: true };
const ENABLE = ["disabled", false];
const DISABLE = ["disabled", true];

// function validateGrammar(input, grammar) {
//   if (!input) return;
//   if (input.trim() === "") return;
//   const output = parseGrammar(input.trim(), grammar);
//   if (typeof output === "object") return;
//   return output;
// }
function err(key, message, errors) {
  if (!errors[key]) errors[key] = [];
  if (!errors[key].includes(message)) errors[key].push(message);
}
function addLabels(elements) {
  return elements.map((e) => {
    if (e.label) return e;
    return { ...e, label: getLabel(e) };
  });

  function getLabel(e) {
    if (!e.name) return "";
    const nothingBeforeUnderscore = e.name.replace(/^[^_]*_/, "");
    const noInitalUnderscores = nothingBeforeUnderscore.replace(/^_*/, "");
    return _.toSentence(noInitalUnderscores).replace(/ col$/, " column");
  }
}
const note = {
  cannotFilter: true,
  chartOverlay: () => [
    { tag: "h3", label: "" },
    { tag: "textarea", rows: 10, name: "message", label: "Message" },
  ],
  validateChart: (properties) => {
    const errors = [];
    const attributes = [];
    if (properties["message"].trim() == "")
      errors.push({ message: "Required" });

    const placeholders = note.chartDefaults(properties);
    for (const name in placeholders) {
      const value = placeholders[name];
      attributes.push({ name, attrs: ["placeholder", value] });
    }

    return { errors, attributes };
  },
  chartDefaults: (properties) => {
    return { chartTitle: "NOTE" };
  },
};
const banner = {
  cannotFilter: true,
  chartOverlay: () => [
    { tag: "h3", label: "" },
    { tag: "select", options: ["h1", "h2", "p"], name: "tag" },
  ],
  validateChart: (properties) => {
    const errors = [];
    const attributes = [];
    // if (properties["message"].trim() == "")
    //   errors.push({ message: "Required" });

    // const placeholders = note.chartDefaults(properties);
    // for (const name in placeholders) {
    //   const value = placeholders[name];
    //   attributes.push({ name, attrs: ["placeholder", value] });
    // }

    return { errors, attributes };
  },
  chartDefaults: (properties) => {
    // return { chartTitle: "NOTE" };
  },
};
const maxMinCalloutOverlay = [
  {
    tag: "select",
    name: "valueType",
    options: ["Max", "Min", "Category"],
  },
  { tag: "select", name: "category" },
  { tag: "input", name: "message" },
];
const validateMaxMinCalloutOverlay = (properties) => {
  const { value, category, valueType } = properties;
  const attributes = [{ names: ["category"], attrs: DISABLE }];
  if (valueType !== "category") return { attributes };
  attributes.push({ names: ["category"], attrs: ENABLE });
  return { attributes };
};
const risk = {
  cannotFilter: true,
  chartOverlay: ({ config, chartType }) => {
    const columns = config.columnNames;
    return [
      { tag: "h3", label: "X axis" },
      { tag: "select", options: columns, name: "x_column", label: "Column" },
      { tag: "text", name: "x_label" },
      { tag: "text", label: "Map", name: "x_labels" },
      { tag: "h3", label: "Y axis" },
      { tag: "select", options: columns, name: "y_column", label: "Column" },
      { tag: "text", name: "y_label" },
      { tag: "text", label: "Map", name: "y_labels" },
      ...ChartFilterUi.elements({ config }),
      ...CountTypeUi.elements({ config }),
      {
        tag: "text",
        placeHolder: "VL, L, M. H, VH",
        label: "Count labels",
        name: "countLabels",
      },
    ];
  },
  validateChart: (properties) => {
    const errors = [];
    const attributes = [];
    const { x_column, y_column, countLabels } = properties;
    if (x_column === y_column) {
      errors.push({
        name: "y_column",
        message: "Must be different to " + x_column,
      });
    }

    const checkArray = (name, length) => {
      const str = properties[name] ?? "";
      const array = str
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v);
      if (array.length != length) {
        errors.push({ name, message: `Required ${length} values` });
      }
    };
    checkArray("x_labels", 10);
    checkArray("y_labels", 10);
    if (countLabels) checkArray("countLabels", 5);
    // AxisUi.validate(properties, errors, attributes, "x_");
    // AxisUi.validate(properties, errors, attributes, "y_");

    CountTypeUi.validate(properties, errors, attributes);
    ChartFilterUi.validate(properties, errors, attributes);
    const placeholders = risk.chartDefaults(properties);
    for (const name in placeholders) {
      const value = placeholders[name];
      attributes.push({ name, attrs: ["placeholder", value] });
    }
    return { errors, attributes };
  },
  chartDefaults: (properties) => {
    const { countType, colOver, x_label, x_column, y_label, y_column } =
      properties;
    const x = x_label ? x_label : x_column;
    const y = y_label ? y_label : y_column;

    const suffix =
      countType === "Count" ? "counts" : countType + " over " + colOver;
    return {
      x_label: x_column,
      y_label: y_column,
      chartTitle: `Risk (${suffix})`.toUpperCase(),
    };
  },
  validateCallout: (properties) => validateMaxMinCalloutOverlay(properties),
  calloutOverlay: maxMinCalloutOverlay,
  getCallout: (properties, chartProperties, data) => {
    return twoByTwo.getCallout(properties, chartProperties, data);
  },
};
const noChart = {
  cannotFilter: true,
  chartOverlay: ({ config }) => {
    const { chartProperties } = config;
    const maxCharts = chartProperties.length;
    return [
      {
        tag: "number",
        min: 1,
        max: maxCharts,
        label: "Position",
        name: "position",
      },
      { tag: "text", label: "Chart title", name: "chartTitle" },
      {
        tag: "select",
        options: ["Small", "Medium", "Large"],
        label: "Chart size",
        name: "chartSize",
      },
      {
        tag: "select",
        options: Object.keys(chartTypes),
        label: "Chart type",
        name: "chartType",
      },
      { tag: "overlay" },
      { tag: "hr" },
      { tag: "button", label: "Cancel" },
      { tag: "button", label: "Apply", class: "disable-on-error" },
    ];
  },
  validateChart: (properties) => {
    const errors = [];
    const attributes = [];
    // const placeholders = dataTable.chartDefaults(properties);
    // for (const name in placeholders) {
    //   const value = placeholders[name];
    //   attributes.push({ name, attrs: ["placeholder", value] });
    // }
    return { errors, attributes };
  },
  chartDefaults: (properties) => {
    // return { chartTitle: "DATA TABLE" };
  },
  validateCallout: (properties) => {}, //to do
  calloutOverlay: [
    {
      tag: "select",
      name: "valueType",
      options: ["Report-date", "Days-to-date", "Workdays-to-date"],
    },
    { tag: "date", name: "targetDate" },
    { tag: "input", name: "message" },
  ],
  getCallout: (properties, config) => {
    const { reportDate } = config;
    if (!reportDate) return { top: "ERR", bottom: "No report date" };
    const { valueType, targetDate, message } = properties;
    const bottom = message ?? "Get palceholder";
    if (!valueType) return { top: "ERR", bottom: "No type" };
    if (valueType === "report-date")
      return { top: _.formatDate(reportDate, "DD-MMM-YY"), bottom };
    if (!targetDate) return { top: "ERR", bottom: "No target date" };
    if (valueType === "days-to-date")
      return { top: _.dateTimeDiff(reportDate, targetDate, "days"), bottom };
    if (valueType === "workdays-to-date")
      return {
        top: _.dateTimeDiff(reportDate, targetDate, "workdays"),
        bottom,
      };
    return { top: "ERR", bottom: `Invalid value type: ${valueType}` };
  },
};
const twoByTwo = {
  cannotFilter: true,
  chartOverlay: ({ config, chartType }) => {
    const columns = config.columnNames;
    return [
      ...AxisUi.elements({ config, prefix: "x_", legend: "X Axis" }),
      ...AxisUi.elements({ config, prefix: "y_", legend: "Y Axis" }),
      ...ChartFilterUi.elements({ config }),
      ...CountTypeUi.elements({ config }),
      {
        tag: "text",
        placeHolder: "VL, L, M. H, VH",
        name: "countLabels",
      },
    ];
  },
  validateChart: (properties) => {
    const errors = [];
    const attributes = [];
    const { x_column, y_column, x_label, y_label } = properties;
    if (x_column === y_column)
      errors.push({ y_column: "Must be dirrent to X axis" });
    CountTypeUi.validate(properties, errors, attributes);
    AxisUi.validate(properties, errors, attributes, "x_");
    AxisUi.validate(properties, errors, attributes, "y_");
    ChartFilterUi.validate(properties, errors, attributes);

    const placeholders = twoByTwo.chartDefaults(properties);
    for (const name in placeholders) {
      const value = placeholders[name];
      attributes.push({ name, attrs: ["placeholder", value] });
    }

    return { errors, attributes };
  },
  chartDefaults: (properties) => {
    const { countType, colOver, x_label, x_column, y_label, y_column } =
      properties;
    const x = x_label ? x_label : x_column;
    const y = y_label ? y_label : y_column;
    const suffix =
      countType === "Count" ? "counts" : countType + " over " + colOver;

    return {
      x_label: x_column,
      y_label: y_column,
      chartTitle: `${x} and ${y} (${suffix})`.toUpperCase(),
    };
  },
  validateCallout: (properties) => validateMaxMinCalloutOverlay(properties),

  calloutOverlay: maxMinCalloutOverlay,
  getCallout: (properties, chartProperties, data) => {
    const { errors, output } = twoByTwo.validateCallout(properties);
    if (errors) {
      const bottom = Object.keys(errors)
        .map((key) => key + " " + errors[key])
        .join(", ");
      return { top: "ERR", bottom };
    }
    const { chartType, countType, colOver, x_column, y_column } =
      chartProperties;
    const { value, message } = properties;
    if (value === "category") {
      const cats = category
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v !== "");
      // if (!Array.isArray(cats)) return error
      // if (cats.length !== 2) return error
      const x = cats[0];
      const y = cats[1];
      const d = data.find((v) => v.x.trim() === x && v.y.trim() === y);
      const top = d ? d.v : "NA";
      const bottom =
        message ?? `Value for ${x_column} = ${x} | ${y_column} = ${y}`;
      return { top, bottom };
    }
    const extent = d3Extent(data, (d) => d.v);
    const top = value === "max" ? extent[1] : extent[0];
    const cats = data
      .filter((v) => v.v === top)
      .map((v) => `${x_column} = ${v.x} | ${y_column} = ${v.y}`);
    const bottom =
      message ??
      (value === "max" ? "Maximum" : "Minimum") + ` at ${cats.join(", ")}`;

    return { top, bottom };
  },
};
const stateChange = {
  cannotFilter: true,
  chartOverlay: ({ config, chartType }) => {
    const columns = config.columnNames;
    const cols = { tag: "select", options: columns };
    const elements = (prefix) => [
      { ...cols, label: "Column", name: prefix + "column" },
      { tag: "text", label: "Label", name: prefix + "label" },
      { tag: "text", label: "Order", name: prefix + "labels" },
    ];
    return [
      { tag: "hr" },
      { ...cols, label: "Id column", name: "idCol" },
      { ...cols, label: "Timestamp column", name: "timestampCol" },
      { tag: "fieldset", legend: "X axis", elements: elements("x_") },

      { tag: "fieldset", legend: "Y axis", elements: elements("y_") },
      ...ChartFilterUi.elements({ config }),
      ...CountTypeUi.elements({ config }),
    ];
  },
  validateChart: (properties) => {
    const errors = [];
    const attributes = [];

    const checkDistinct = (col1, col2) => {
      if (properties[col1] === properties[col2])
        errors.push({ name: col2, message: "Must be different to " + col1 });
    };

    checkDistinct("idCol", "timestampCol");
    checkDistinct("timestampCol", "y_column");
    checkDistinct("timestampCol", "x_column");
    checkDistinct("idCol", "y_column");
    checkDistinct("idCol", "x_column");
    checkDistinct("x_column", "y_column");

    CountTypeUi.validate(properties, errors, attributes);
    ChartFilterUi.validate(properties, errors, attributes);

    const placeholders = stateChange.chartDefaults(properties);
    for (const name in placeholders) {
      const value = placeholders[name];
      attributes.push({ name, attrs: ["placeholder", value] });
    }
    return { errors, attributes };
  },
  chartDefaults: (properties) => {
    const { x_label, x_column, y_label, y_column, countType } = properties;
    const x = x_label ? x_label : x_column;
    const y = y_label ? y_label : y_column;

    return {
      countLabels: "VL, L, M. H, VH",
      x_label: x_column,
      y_label: y_column,
      chartTitle: `${countType} of transition${
        countType === "Count" ? "s" : " times"
      }`.toUpperCase(),
    };
    return { chartTitle: "TO DO" };
  },
  validateCallout: (properties) => validateMaxMinCalloutOverlay(properties),
  calloutOverlay: maxMinCalloutOverlay,
  getCallout: (properties, chartProperties, data) => {
    return twoByTwo.getCallout(properties, chartProperties, data);
  },
};
const dataTable = {
  cannotFilter: true,
  chartOverlay: () => [
    { tag: "hr" },
    {
      tag: "number",
      label: "Rows to display",
      value: 10,
      max: 100,
      min: 1,
      name: "maxEntries",
    },
  ],
  validateChart: (properties) => {
    const errors = [];
    const attributes = [];
    const placeholders = dataTable.chartDefaults(properties);
    for (const name in placeholders) {
      const value = placeholders[name];
      attributes.push({ name, attrs: ["placeholder", value] });
    }
    return { errors, attributes };
  },
  chartDefaults: (properties) => {
    return { chartTitle: "DATA TABLE" };
  },
};
const dataDescription = {
  cannotFilter: true,
  chartOverlay: () => [],
  validateChart: (properties) => {
    const errors = [];
    const attributes = [];
    const placeholders = dataDescription.chartDefaults(properties);
    for (const name in placeholders) {
      const value = placeholders[name];
      attributes.push({ name, attrs: ["placeholder", value] });
    }
    return { errors, attributes };
  },
  chartDefaults: (properties) => {
    return { chartTitle: "DATA DESCRIPTION" };
  },
};
const plan = {
  cannotFilter: true,
  chartOverlay: ({ config, chartType }) => {
    const columns = config.columnNames;
    const col = { tag: "select", options: columns };
    const colSpace = { tag: "select", options: ["", ...columns] };
    return [
      { tag: "hr" },
      { ...col, label: "Description column", name: "descriptionCol" },
      {
        tag: "fieldset",
        legend: "First set of dates",
        elements: [
          { ...col, label: "Start date column", name: "startDateCol" },
          { ...col, label: "End date column", name: "endDateCol" },
          { tag: "text", label: "Label", name: "firstLabel" },
        ],
      },

      {
        tag: "fieldset",
        legend: "Second set of dates",
        elements: [
          {
            ...colSpace,
            label: "Start date column",
            name: "secondStartDateCol",
          },
          { ...colSpace, label: "End date column", name: "secondEndDateCol" },
          { tag: "text", label: "Label", name: "secondLabel" },
        ],
      },
      {
        tag: "fieldset",
        legend: "RAG ",
        elements: [
          { ...colSpace, label: "RAG column", name: "ragCol" },
          { tag: "text", label: "RAG map", name: "ragMap" },
        ],
      },
      ...ChartFilterUi.elements({ config }),
      ...AnnotationUi.elements(),
    ];
  },
  validateChart: (properties) => {
    const errors = [];
    const attributes = [];

    const different = (col1, col2) => {
      if (properties[col1] === properties[col2])
        errors.push({ [col2]: "Must be different" });
    };
    const {
      secondStartDateCol,
      secondEndDateCol,
      secondLabel,
      chartFilter,
      ragCol,
    } = properties;

    // different("descriptionCol", "startDateCol");
    // different("descriptionCol", "endDateCol");
    different("startDateCol", "endDateCol");
    // if (!firstLabel) err("firstLabel", "Required", errors);

    if (secondStartDateCol) {
      // if (!secondLabel) err("secondLabel", "Required");
      // different("descriptionCol", "secondStartDateCol");
      // different("endDateCol", "secondStartDateCol");
      // different("secondStartDateCol", "secondEndDateCol");
      if (!secondEndDateCol) errors.push({ secondEndtDateCol: "Required" });
    }
    if (secondEndDateCol) {
      if (!secondLabel) err("secondLabel", "Required");
      // different("descriptionCol", "secondEndDateCol");
      // different("endDateCol", "secondEndDateCol");
      // different("startDateCol", "secondEndDateCol");
      // different("secondStartDateCol", "secondEndDateCol");
      if (!secondStartDateCol) errors.push({ secondStartDateCol: "Required" });
    }
    if (secondStartDateCol && secondEndDateCol)
      different("secondStartDateCol", "secondEndDateCol");

    if (ragCol) {
      different("descriptionCol", "ragCol");
      different("endDateCol", "ragCol");
      different("startDateCol", "ragCol");
      different("secondStartDateCol", "ragCol");
      different("secondEndDateCol", "ragCol");
      //map with eight entries B, R A G
    }

    const placeholders = plan.chartDefaults(properties);
    for (const name in placeholders) {
      const value = placeholders[name];
      attributes.push({ name, attrs: ["placeholder", value] });
    }
    AnnotationUi.validate(properties, errors, attributes);
    return { errors, attributes };

    // const errors = {};

    // const annotationError = validateAnnotations(annotations);
    // if (annotationError) err("annotations", annotationError, errors);

    // const chartFilterError = validateGrammar(chartFilter, CHART_FILTER_GRAMMAR);
    // if (chartFilterError) err("chartFilter", chartFilterError, errors);
    // const isValid = Object.keys(errors).length === 0;
    // // return { isValid, errors };
    // return isValid ? {} : { errors };
  },
  chartDefaults: (properties) => {
    return { firstLabel: "Plan", secondLabel: "Actuals", chartTitle: "PLAN" };
  },
};
const trend = {
  cannotFilter: true,
  orderedValues: (chartProp, trendEndDate) => {
    // return chartTypes["Trend OC"].orderedValues(chartProp, trendEndDate);
    const { trendStartDate } = chartProp;

    const datePoints = [];
    const dateDifference = _.dateTimeDiff(trendStartDate, trendEndDate, "Days"); //+ 1
    const maxDataPoints = 30;
    const millisecondsInDay = 24 * 60 * 60 * 1000;
    const deltaMilliseconds =
      millisecondsInDay * Math.max(1.0, dateDifference / maxDataPoints);

    let date = new Date(trendEndDate);
    let YYYYMMDD = date.toISOString().substring(0, 10);

    while (YYYYMMDD >= trendStartDate) {
      datePoints.unshift(YYYYMMDD);
      date.setMilliseconds(date.getMilliseconds() - deltaMilliseconds);
      YYYYMMDD = date.toISOString().substring(0, 10);
    }

    return datePoints;
  },
  chartOverlay: ({ config, chartType }) => {
    const { reportDate, columnNames } = config;
    const cols = { tag: "select", options: columnNames };

    return [
      {
        tag: "fieldset",
        legend: "X axis",
        elements: [
          ...(chartType === "Trend"
            ? [{ ...cols, label: "Date column", name: "x_column" }]
            : [
                { ...cols, label: "Open date column", name: "openDateCol" },
                { ...cols, label: "Close date column", name: "closeDateCol" },
              ]),
          { tag: "text", label: "Label", name: "x_label" },
        ],
      },

      {
        tag: "date",
        value: _.addDays(reportDate, -28),
        label: "Trend start date",
        name: "trendStartDate",
      },
      ...ChartFilterUi.elements({ config }),
      ...AnnotationUi.elements(),
      ...PlanUi.elements(),
      ...ForecastUi.elements(),
    ];
  },
  validateChart: (properties, { reportDate }) => {
    const { trendStartDate } = properties;
    const errors = [];
    const attributes = [];
    // if (x_label.trim() === "") err("x_label", "Mandatory", errors)

    if (!(trendStartDate < reportDate))
      errors.push({ trendStartDate: "Must be < report date" });
    AnnotationUi.validate(properties, errors, attributes);
    ChartFilterUi.validate(properties, errors, attributes);
    PlanUi.validate(properties, errors, attributes);
    ForecastUi.validate(properties, errors, attributes);
    const placeholders = trend.chartDefaults(properties);
    for (const name in placeholders) {
      const value = placeholders[name];
      attributes.push({ name, attrs: ["placeholder", value] });
    }
    return { errors, attributes };
  },
  chartDefaults: (properties) => {
    const { x_label, x_column } = properties;
    const x = x_label ? x_label : x_column;
    return {
      x_label: x_column,
      chartTitle: `${x} over time`.toUpperCase(),
    };
  },

  validateCallout: (properties) => {
    const { value, category } = properties;
    if (value !== "category") return {};
    const cats = category
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v !== "");
    const error = {
      errors: {
        category: "Required 2 values; first is date|report-date",
      },
    };
    if (cats.length !== 2) return { error };
    const firstCat = cats[0];
    if (firstCat.toLowerCase() === "report-date") return {};
    if (_.isValidDate(firstCat)) return {};
    return { error };
  },
};
const bar = {
  chartOverlay: ({ config, chartType }) => {
    // const { reportDate, columnNames } = config;
    // const cols = { tag: "select", options: columnNames };
    return [
      // { tag: "h3", label: "X axis" },
      ...AxisUi.elements({ config, prefix: "x_", legend: "X Axis" }),
      ...ChartFilterUi.elements({ config }),
      ...CountTypeUi.elements({ config }),
    ];
  },
  validateChart: (properties) => {
    const errors = [];
    const attributes = [];
    AxisUi.validate(properties, errors, attributes, "x_");
    ChartFilterUi.validate(properties, errors, attributes);
    CountTypeUi.validate(properties, errors, attributes);
    const placeholders = bar.chartDefaults(properties);
    for (const name in placeholders) {
      const value = placeholders[name];
      attributes.push({ name, attrs: ["placeholder", value] });
    }
    console.log(attributes);
    return { errors, attributes };
  },
  chartDefaults: (properties) => {
    const { countType, colOver, x_label, x_column, x_bin, x_dataType } =
      properties;
    const x = x_label ? x_label : x_column;
    const suffix =
      countType === "Count" ? "counts" : countType + " over " + colOver;

    const binned = x_dataType === "Number" && x_bin ? "Binned " : "";
    // const list = chartType === "List" ? "Members in " : ""
    // const list = chartType === "List Members"? "Members in " : ""
    return { chartTitle: `${binned}${suffix} by ${x}`.toUpperCase() };
  },

  validateCallout: (properties) => validateMaxMinCalloutOverlay(properties),
  calloutOverlay: maxMinCalloutOverlay,
  getCallout: (properties, chartProperties, data) => {
    const { errors, output } = bar.validateCallout(properties);
    // const errors = { category: "Required", chartNumber: "Required" }
    if (errors) {
      const bottom = Object.keys(errors)
        .map((key) => key + " " + errors[key])
        .join(", ");
      return { top: "ERR", bottom };
    }
    const { chartType, countType, colOver, x_column } = chartProperties;
    const chartTitle =
      chartProperties.chartTitle ??
      bar.chartDefaults(chartProperties).chartTitle;
    const { value, category, message } = properties;
    if (value === "category") {
      const cat = category;
      const d = data.find((v) => v.x === cat);
      const top = d ? d.v : "NA";
      const bottom = message ?? `Value for ${x_column} = ${cat}`;
      return { top, bottom };
    }
    const extent = d3Extent(data, (d) => d.v);
    const top = value === "max" ? extent[1] : extent[0];
    const cats = data.filter((v) => v.v === top).map((v) => v.x);
    const bottom =
      message ??
      (value === "max" ? "Maximum" : "Minimum") +
        " " +
        (countType === "Count"
          ? "count"
          : (countType + " over " + colOver).toLowerCase()) +
        " " +
        `at ${x_column} = ${cats.join(", ")}`;

    return { top, bottom };
  },
};

// function chartFilterElements(chartFilter) {
//   //to do
// }
// function selectColumn(label, name, addSpace = false) {
//   //To do
// }
const chartTypes = {
  Banner: { ...banner },
  Note: { ...note },
  Risk: { ...risk },
  "2X2": { ...twoByTwo },
  "State Change": { ...stateChange },
  "Data Table": { ...dataTable },
  "Data Description": { ...dataDescription },
  Trend: { ...trend },
  "Trend OC": { ...trend },
  Bar: { ...bar },
  Plan: { ...plan },
};
function validateChart(properties, { reportDate }) {
  const { chartType } = properties;
  if (!chartTypes[chartType]) return {};
  if (!chartTypes[chartType].validateChart) return {};
  return chartTypes[chartType].validateChart(properties, { reportDate });
}
function getCalloutOverlay(chartType) {
  const validChartType = chartTypesList().includes(chartType);
  if (!validChartType) return noChart.calloutOverlay;
  const calloutOvelay = chartTypes[chartType].calloutOverlay;
  if (calloutOvelay) return calloutOvelay;
  return [{ tag: "p", label: "No call out for this chart" }];
}
function validateCallout(proprties) {
  const { chartType } = properties;
  const validateCallout =
    chartType === "None"
      ? noChart.validateCallout
      : chartTypes[chartType].calloutOverlay;
  return validateCallout(properties);
}

function chartTypesList() {
  return Object.keys(chartTypes);
}
class AnnotationUi {
  static positions = ["th", "tv", "mh", "mv", "bh", "bv"];
  static elements() {
    return [
      {
        tag: "table",
        label: "Annotations",
        name: "annotations",
        options: {
          ui: [
            { tag: "date", label: "Date", name: "date" },
            { tag: "text", label: "Label", name: "label" },
            {
              tag: "select",
              options: AnnotationUi.positions,
              label: "Position",
              name: "position",
            },
          ],
        },
      },
    ];
  }
  static validate(values, errors, attributes) {
    const { annotations } = values;

    if (values["annotations--"]) {
      const annoationsDate = values["annotations-date"];
      const annoationsLabel = values["annotations-label"];
      const annoationsPosition = values["annotations-position"];

      if (!_.isValidDate(annoationsDate))
        errors.push({ "annotations-date": "Invalid date" });

      if (!_.isPresent(annoationsLabel))
        errors.push({ "annotations-label": "Label required" });

      if (!AnnotationUi.positions.includes(annoationsPosition))
        setError("Invalid position");
    }

    if (!_.isPresent(annotations)) return { errors, attributes };

    const annotationArray = _.toRows(annotations, 3)
      .map((row, i) => ({ row, i }))
      .filter((v) => v.row.join("").trim() !== "");
    if (annotationArray.length === 0) return { errors, attributes };

    const errorMessage = [];
    annotationArray.forEach((triplet, j) => {
      // console.log(triplet);
      const { row, i } = triplet;
      const [date, label, position] = row;

      function setError(message) {
        errorMessage.push(message + ` in row ${j + 1}`);
      }

      if (!_.isValidDate(date)) setError("Invalid date");

      if (!_.isPresent(label)) setError("Label required");

      if (!AnnotationUi.positions.includes(position))
        setError("Invalid position");
    });

    if (errorMessage.length > 0)
      errors.push({ annotations: errorMessage.join(", ") });

    return { errors, attributes, annotations: getannotations() };

    function getannotations() {
      if (errorMessage.length > 0) return;
      return annotationArray;
    }
  }
}
class PlanUi {
  static elements() {
    return [
      {
        tag: "object",
        name: "plan",
        label: "Plan",
        options: {
          ui: [
            { tag: "date", label: "Start date", name: "startDate" },
            { tag: "date", label: "End date", name: "endDate" },
            { tag: "text", label: "Scope from", name: "scopeFrom" },
            // { tag: "text", label: "Scope to", name: "scopeTo",},
            {
              tag: "date-select",
              label: "Scope to",
              name: "scopeTo",
              options: "max,min",
            },
            { tag: "text", label: "Points", name: "points" },
            { tag: "text", label: "Lable", name: "label" },
          ],
        },
      },
    ];
  }
  static validate(values, errors, attributes) {
    const presetPlans = {
      line: [0, 1],
      sigmoid: [0, 0.02, 0.05, 0.12, 0.27, 0.5, 0.73, 0.88, 0.95, 0.98, 1],
    };
    const isPreset = (points) =>
      Object.keys(presetPlans).includes(points.toLowerCase());
    const errBefore = errors.length;
    const { plan } = values;
    if (!_.isPresent(plan)) return { errors, attributes };
    const planObj = _.parse(plan);
    if (_.isNoValueObject(planObj)) return { errors, attributes };
    const { startDate, endDate, scopeFrom, scopeTo, points, label } = planObj;
    const prefix = "plan-";
    const err = (e) => {
      const [key, value] = Object.entries(e)[0];
      const newkey = prefix + key;
      errors.push({ [newkey]: value });
    };
    if (!_.isValidDate(startDate))
      err({ startDate: "Start date must be date" });

    if (!_.isValidDate(endDate)) err({ endDate: "End date must be date" });

    const isEndGtStart =
      _.isValidDate(endDate) && _.isValidDate(startDate) && endDate > startDate;
    if (!isEndGtStart) err({ endDate: "End date must be > start date" });

    if (isNaN(scopeFrom) || Number(scopeFrom) < 0)
      err({ scopeFrom: "Scope from must be a number >= 0" });

    const isValidScopeTo =
      scopeTo && (scopeTo.toLowerCase() === "max" || Number(scopeTo) > 0);
    if (!isValidScopeTo) err({ scopeTo: `Scope to must be max or a number` });

    const isValidPoints =
      points &&
      (isPreset(points) ||
        _.getArray(points, { format: "number" }).length >= 2);
    if (!isValidPoints)
      err({
        points: `Points to must be "line" or "sigmoid" or an array of min 2 numbers`,
      });

    const labelPlaceholder = "Plan";
    attributes.push({
      name: prefix + "label",
      attrs: ["placeholder", labelPlaceholder],
    });

    return { errors, attributes, plan: planValues() };

    function planValues() {
      if (errors.length > errBefore) return;
      const planPoints = isPreset(points)
        ? presetPlans[points.toLowerCase()]
        : _.getArray(points, { format: "number" });

      return {
        startDate,
        endDate,
        scopeFrom: Number(scopeFrom),
        scopeTo:
          typeof scopeTo === "string" ? scopeTo.toLowerCase() : Number(scopeTo),
        points: planPoints,
        label: label.trim() === "" ? labelPlaceholder : label.trim(),
      };
    }
  }
}
function getParsedValue(type, unpasedValue) {
  if (!_.isPresent(type)) return;
  if (!_.isPresent(unpasedValue)) return;
  const uis = {
    plan: PlanUi,
    forecast: ForecastUi,
    annotations: AnnotationUi,
  };
  const ui = uis[type];
  if (!ui) return;
  const errors = [],
    attributes = [];
  const value = ui.validate({ [type]: unpasedValue }, errors, attributes);
  console.assert(value[type], `Type: ${type}, value: ${unpasedValue}`);
  return value[type];
}
class ChartFilterUi {
  static elements({ config }) {
    // "action: exclude|include, where: [column, eq|neq, val|[v1,v2], and|or ...]",
    const columns = config.columnNames;

    return [
      {
        tag: "table",
        label: "Chart filter",
        name: "chartFilter",
        options: {
          ui: [
            {
              tag: "select",
              options: ["and", "or"],
              label: "Logical op",
              name: "logicalOp",
            },
            {
              tag: "select",
              options: columns,
              label: "Column",
              name: "column",
            },
            {
              tag: "select",
              options: ["eq", "neq", "in", "nin"],
              label: "Compare op",
              name: "compareOp",
            },
            { tag: "text", label: "Value(s)", name: "value" },
          ],
        },
      },
    ];
  }
  static validate(values, errors, attributes) {
    const { chartFilter } = values;
    console.log({ chartFilter, d: Dialog.data() }); // const showWhere = { name: "chartFilter", ...SHOW };
    const errBefore = errors.length;

    if (values["chartFilter--"]) {
      // const logicalOp = values["chartFilter-logicalOp"];
      // const column = values["chartFilter-column"];
      // const compareOp = values["chartFilter-compareOp"];
      const value = values["chartFilter-value"];

      if (!_.isPresent(value))
        errors.push({ "chartFilter-value": "Value required" });
    }
    // return { errors, attributes, chartFilter: fiterValues() };
    const conditions = _.toRows(chartFilter, 4)
      .map((row, i) => ({ row, i }))
      .filter((v) => v.row.join("").trim() !== "");

    if (conditions.length === 0) return { errors, attributes };

    const errorMessage = [];

    // if (conditions.length > 0)
    //   errors.push({ "chartFilter-cell-0-0": `Condition required` });
    // else
    conditions.forEach((quad, j) => {
      const { row, i } = quad;
      // const prefix = "chartFilter-cell-" + i + "-";
      const [andOr, column, op, values] = row;

      function setError(message) {
        errorMessage.push(message + ` in row ${j + 1}`);
      }

      if (!_.isPresent(column)) setError(`Column required`);

      if (!_.isPresent(op)) setError(`Op required`);

      if (!_.isPresent(values)) setError(`Values required`);

      if (i > 0 && _.isPresent(andOr)) setError(`And/or required`);
    });

    return { errors, attributes, chartFilter: fiterValues() };

    function fiterValues() {
      return;
      if (errors.length > errBefore) return;
      // if (!_.isPresent(chartFilterType)) return;
      // if (chartFilterType.toLowerCase() === "none") return;
      const where = conditions.map((quad) => {
        const [andOr, column, op, values] = quad.row;
        return { column, op, values, andOr };
      });
      // console.log({ action: chartFilterType.toLowerCase(), where });
      // return { action: chartFilterType.toLowerCase(), where };
      return where;
    }
  }
}
class DatePickerUi {
  static elements({ selectValues }) {
    return [
      {
        tag: "select",
        name: "select",
        options: [...selectValues, "Date"],
      },
      {
        tag: "date",
        name: "date",
      },
    ];
  }
  static validate(values, errors, attributes) {
    console.log(values);
    const { chartFilter } = values;
    const showWhere = { name: "chartFilter", ...SHOW };
    const errBefore = errors.length;
    attributes.push(showWhere);

    // const hideWhere = { ...showWhere, ...HIDE };

    const conditions = _.toRows(chartFilter, 4)
      .map((row, i) => ({ row, i }))
      .filter((v) => v.row.join("").trim() !== "");

    if (conditions.length === 0)
      errors.push({ "chartFilter-cell-0-0": `Condition required` });
    else
      conditions.forEach((quad, j) => {
        const { row, i } = quad;
        const prefix = "chartFilter-cell-" + i + "-";
        const [column, op, values, andOr] = row;

        if (!_.isPresent(column))
          errors.push({ [prefix + 0]: `Column required in row ${row + 1}` });

        if (!_.isPresent(op))
          errors.push({ [prefix + 1]: `Op required in row ${row + 1}` });

        if (!_.isPresent(values))
          errors.push({ [prefix + 2]: `Values required in row ${row + 1}` });

        const hasNextRow = conditions[j + 1];

        if (!hasNextRow && _.isPresent(andOr))
          errors.push({
            [prefix + 3]: `And/or not required in row ${row + 1}`,
          });
        if (hasNextRow && !_.isPresent(andOr))
          errors.push({ [prefix + 3]: `And/or required in row ${row + 1}` });
      });

    return { errors, attributes, chartFilter: fiterValues() };

    function fiterValues() {
      if (errors.length > errBefore) return;
      if (!_.isPresent(chartFilterType)) return;
      if (chartFilterType.toLowerCase() === "none") return;
      const where = conditions.map((quad) => {
        const [column, op, values, andOr] = quad.row;
        return { column, op, values, andOr };
      });
      console.log({ action: chartFilterType.toLowerCase(), where });
      return { action: chartFilterType.toLowerCase(), where };
    }
  }
}
class ForecastUi {
  static elements() {
    return [
      // {
      //   tag: "textarea",
      //   name: "forecast",
      // },
      {
        tag: "object",
        name: "forecast",
        label: "Forecast",
        options: {
          ui: [
            { tag: "text", label: "Look back", name: "lookBack" },
            { tag: "text", label: "Forecast to", name: "forecastTo" }, //no date is max
            { tag: "text", label: "Label", name: "label" },
          ],
        },
        // todo: introduce date-input
      },
    ];
  }
  static validate(values, errors, attributes) {
    const { forecast } = values;
    if (!_.isPresent(forecast)) return { errors, attributes };
    // if (!forecast || forecast.trim() === "") return true;
    const forecastObj = _.parse(forecast);
    if (_.isNoValueObject(forecastObj)) return { errors, attributes };
    const prefix = "forecast-";
    const errBefore = errors.length;
    const { lookBack, forecastTo, label } = forecastObj;
    const isValidLookBack = _.isInteger(lookBack) && Number(lookBack) > 0;
    if (!isValidLookBack)
      errors.push({ [prefix + "lookBack"]: "Look back must be a integer > 0" });
    const isValidForecastTo =
      forecastTo.toLowerCase() === "max" || _.isValidDate(forecastTo);
    if (!isValidForecastTo)
      errors.push({
        [prefix + "forecastTo"]: `Forecast to must be "max" or date`,
      });

    // if (label.trim() === "") errors.push({ forecast: `Label required` });

    // return { errors, attributes };
    const labelPlaceholder = "Forecast";
    attributes.push({
      name: prefix + "label",
      attrs: ["placeholder", labelPlaceholder],
    });

    return { errors, attributes, forecast: forecastValues() };

    function forecastValues() {
      if (errors.length > errBefore) return;

      return {
        lookBack,
        forecastTo:
          typeof forecastTo === "string"
            ? forecastTo.toLowerCase()
            : Number(forecastTo),
        label: label.trim() === "" ? labelPlaceholder : label.trim(),
      };
    }
  }
}
class CountTypeUi {
  static elements({ config }) {
    const columns = config.columnNames;
    return [
      {
        tag: "details",
        legend: "Count type",
        elements: [
          {
            tag: "select",
            value: "Count",
            options: ["Count", "Sum", "Average"],
            label: "Type",
            name: "countType",
          },
          {
            tag: "select",
            label: "Over column",
            options: columns,
            name: "colOver",
          },
        ],
      },
    ];
  }
  static validate(values, errors, attributes) {
    const { countType } = values;
    attributes.push({ name: "colOver", attrs: DISABLE });
    if (!countType.startsWith("Count"))
      attributes.push({ name: "colOver", attrs: ENABLE });
    return { errors, attributes };
  }
  static description(values) {
    const { countType, colOver } = values;
    return countType === "Count" ? countType : `${countType} over ${colOver}`;
  }
}
class AxisUi {
  static elements(options) {
    const { config, prefix, legend } = options;
    const columns = config.columnNames;
    console.log({ config });
    const els = [
      { tag: "select", label: "Column", options: columns, name: "column" },
      {
        tag: "select",
        label: "Data type",
        options: ["Date", "String", "Number", "List", "List Members"].sort(),
        value: "String",
        name: "dataType",
      },
      {
        tag: "select",
        label: "Date formats",
        value: "MMM",
        options: ["YYYY", "MMM", "MMM-YY", "DDD", "DD", "W8", "4W4", "8W"],
        name: "dateFormat",
      },
      { tag: "text", label: "Bin values", name: "bin" },
      {
        tag: "text",
        label: "List separator",
        value: ",",
        name: "separator",
      },
      { tag: "text", label: "Axis labels", name: "labels" },
      { tag: "text", label: "Axis title", name: "label" },
    ];
    const elements = els.map((e) =>
      e.name ? { ...e, name: prefix + e.name } : e
    );
    // return elements;
    return [{ tag: "fieldset", legend, elements }];
  }
  static validate(values, errors, attributes, prefix) {
    const fix = (names) =>
      Array.isArray(names) ? names.map((v) => prefix + v) : prefix + names;
    const dataType = values[fix("dataType")];

    attributes.push({
      names: fix(["dateFormat", "bin", "separator", "labels"]),
      ...HIDE,
    });

    const show = (x) => attributes.push({ name: fix(x), ...SHOW });

    if (dataType === "Date") show("dateFormat");

    if (dataType === "Number") {
      show("bin");
      const bin = values[fix("bin")];
      const isValidBin = () => {
        if (!bin) return true;
        if (bin.trim() === "") return true;
        if (!isNaN(bin)) {
          if (_.isInteger(bin)) if (Number(bin) > 1) return true;
          return false;
        }
        const bins = bin.split(",");
        // if (!Array.isArray(binArray)) return false; //err("x_bin", binError, errors);
        if (bins.length < 2) return false; //err("x_bin", binError, errors);
        for (let i = 0; i <= bins.length - 1; i++) {
          const v = Number(bins[i]);
          if (isNaN(v)) return false; //err("x_bin", binError, errors);
          if (i > 0 && v <= Number(bins[i - 1])) return false; //err("x_bin", binError, errors);
        }
        return true;
      };
      if (!isValidBin())
        errors.push({
          name: fix("bin"),
          message: "Must be integer > 1 or list of increasing numbers",
        });
    }

    if (dataType === "List" || dataType === "List Members") show("separator");

    if (dataType === "String") show("labels");
    return { errors, attributes };
  }
}

function isArray(input, options) {
  const array = Array.isArray(input)
    ? input
    : typeof input === "string"
    ? input.split(",")
    : undefined;
  if (!array) return false;
  if (!options) return true;
  let x = true;

  if (options.length && array.length !== options.length) x = false;
  if (options.multiples && array.length % options.multiples !== 0) x = false;
  if (options.numbers && array.filter((v) => isNaN(v)).length > 0) x = false;
  if (options.noSpaces && array.filter((v) => v.trim() === "").length > 0)
    x = false;
  if (
    options.acsending &&
    array.filter((v, i) =>
      i > 0
        ? options.numbers
          ? Number(v) > Number(array[i - 1])
          : v > array[i - 1]
        : true
    ).length > 0
  )
    x = false;

  return x;
}
