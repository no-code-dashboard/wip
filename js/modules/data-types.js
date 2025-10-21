"use strict"
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

export const dataTypes = {
  Date: {
    formats: ["YYYY", "MMM", "MMM-YY", "DDD", "DD", "W8", "4W4", "8W"],
    getFormattedValue: (v, { dateFormat = "MMM", reportDate }) => {
      if (v.trim() === "") return DISPLAY_SPACES;
      if (!_.isValidDate(v)) return DISPLAY_INVALID_DATE;

      const positionOfW = dateFormat.indexOf("W");
      if (positionOfW === -1) return _.formatDate(v, dateFormat);

      const min = positionOfW === 0 ? 0 : -Number(dateFormat[0]);
      const max =
        positionOfW === dateFormat.length
          ? 0
          : Number(dateFormat[positionOfW + 1]);
      function formatWeek(w, min, max) {
        if (w < min) return DISPLAY_LESS;
        if (w > max) return DISPLAY_MORE;
        return (w ? w : "") + "W";
      }
      const days = _.dateTimeDiff(reportDate, v, "Days");
      const weeks = Math.floor(days / 7);
      return formatWeek(weeks, min, max);
    },
    getCategories: ({ dateFormat = "MMM" }) => {
      if (dateFormat == "MMM") return MONTHS;
      if (dateFormat == "DDD") return WEEKDAYS;
      if (dateFormat == "DD") {
        const days = Array.from({ length: 32 }, (_, i) => i + 1);
        return days;
      }
      const getExtent = (dateFormat) => {
        if (dateFormat[0] === "W")
          return { min: 0, max: Number(dateFormat[1]) };
        if (dateFormat[1] === "W")
          return {
            min: -Number(dateFormat[0]),
            max: Number(dateFormat[2]),
          };
      };
      // if (dateFormat.indexOf("W") !== -1) {
      if (dateFormat.includes("W")) {
        const { min, max } = getExtent(dateFormat);
        const weeks = [DISPLAY_LESS];
        for (let i = min; i <= max; i++) weeks.push((i ? i : "") + "W");
        weeks.push(DISPLAY_MORE);
        return weeks;
      }
      return [];
    },
  },
  Number: {
    getFormattedValue: (v, { bin }) => {
      if (isNaN(v)) {
        if (v.trim() === "") return DISPLAY_SPACES;
        return DISPLAY_INVALID_NUMBER;
      }
      const number = Number(v);
      if (!bin) return number;
      function binnedValues(v, bin) {
        const label = (i) => `${bin[i - 1]}-${bin[i]}`;

        if (bin.length < 2) return v;

        if (v < bin[0]) return DISPLAY_LESS;
        if (v > bin[bin.length - 1]) return DISPLAY_MORE;
        if (v == bin[0]) return label(1);
        const i = bin.findIndex((e) => v <= e);
        return label(i);
      }
      const binArray = Array.isArray(bin) ? bin : _.cleanArray(bin, "Number");

      return binnedValues(number, binArray);
    },
    getCategories: ({ bin }) => {
      if (!bin) return [];
      const binLabels = [];
      const getBinLabel = dataTypes["Number"].getFormattedValue;
      bin.forEach((v, i) => {
        if (i > 0) binLabels.push(getBinLabel(v, { bin }));
      });
      binLabels.unshift(DISPLAY_LESS);
      binLabels.push(DISPLAY_MORE);
      return binLabels;
    },
  },
  String: {
    getFormattedValue: (v) => v.trim(),
    getCategories: ({ order }) =>
      order ? order.split(",").map((v) => v.trim()) : [],
  },
  List: {
    getFormattedValue: (v, { separator }) => {
      const list = v.trim();
      if (list === "") return 0;
      const rawValues = list.split(separator).map((v) => v.trim());
      const uniqueValues = new Set(rawValues);
      return [...uniqueValues].filter((v) => v !== "").length;
    },
    getCategories: () => [],
  },
  "List Members": {
    getFormattedValue: (v, { separator }) => {
      const list = v.trim();
      if (list === "") return 0;
      const rawValues = list.split(separator).map((v) => v.trim());
      const uniqueValues = new Set(rawValues);
      return [...uniqueValues].filter((v) => v !== "");
    },
    getCategories: () => [],
  },
};