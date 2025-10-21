"use strict";
import { dataTypes } from "./data-types.js";
import { _ } from "./util.js";

export { Dialog };

/**
 * To do
 * resolve "Form submission canceled because the form is not connected"
 *
 */

function isSpecial(tag) {
  const specials = [
    "tag",
    "label",
    "value",
    "name",
    "elements",
    "options",
    "data-type",
    "data-callback",
  ];
  return specials.includes(tag);
}
function isSupportedTag(tag) {
  const tags = [
    "text",
    "date",
    "date-select",
    "select",
    "radio",
    "checkbox",
    "fieldset",
    "details",
    "table",
    "object",
    "data-callback",
  ];
  return tags.includes(tag);
}
function isInput(tag) {
  return ["text", "date", "number", "range"].includes(tag);
}

let dialog, alertButtonPressed;

let hasErrors = false;
//TO DO remove all styles
const HTMLs = {
  dialog: (legend) =>
    `<dialog class="dialog">
          <form method="dialog">
            <fieldset>
                <legend class="legend-main">${legend}</legend>
                <main></main>
            </fieldset>
          </form>
      </dialog>`,

  //individuals
  input: (label, type, name) =>
    `<p id="${name}-wrapper">
          <label for="${name}">${label}</label>
          <input type="${type}" id="${name}" name=${name} tabindex="0">
      </p>`,
  textarea: (label, name) =>
    `<div id="${name}-wrapper"">
          <label style="display:block" for="${name}">${label}</label>
          <textarea id="${name}" name=${name} tabindex="0" rows=1></textarea>
      </div>`,
  select: (label, name) =>
    `<p id="${name}-wrapper">
          <label for="${name}">${label}</label>
          <select id="${name}" name=${name} tabindex="0"></select>
        </p>`,
  button: (label) => `<button tabindex="0">${label}</button>`,
  checkbox: (label, checked, name) =>
    `<p id=""${name}-wrapper"">
          <input type="checkbox" id="${name}"
           ${checked ? "checked" : ""} 
           name=${name} tabindex="0">
          <label for="${name}">${label}</label>
      </p>`,
  //grouped items
  radio: (label, name) =>
    `<fieldset>
        <legend>${label}</legend>
        <p id=""${name}-wrapper"">
          <span></span>
        </p>
      </fieldset>`,
  fieldset: (legend) =>
    `<fieldset>
        <legend>${legend}</legend>
      </fieldset>`,
  details: (legend) =>
    `<fieldset>
      <details>
        <summary>${legend}</summary>
        <div id="detail-wrapper"></div>
      </details>
    </fieldset>`,
  error: (messages) => `<p class="error-message">${messages}</p>`,
};
function getElement(name) {
  return _.select(`[name = ${name}]`, dialog);
}
function getWrapper(name) {
  return _.select(`[id = ${name}-wrapper]`);
}

function setElementsAttrs(specifiers) {
  if (!specifiers) return;

  const specs = Array.isArray(specifiers) ? specifiers : [specifiers];

  for (const spec of specs) {
    const isName = spec.name || spec.names;

    const { names, name, ids, id, attrs, applyToWrapper } = spec;

    console.assert(Array.isArray(attrs), `"attrs" not array`);
    const [attr, value, action] = attrs;
    const isValidValueType =
      typeof value === "string" || typeof value === "boolean";
    if (!isValidValueType) return;
    const nameOrId = name ? name : id;

    const selectors = isName ? (names ? names : [name]) : ids ? ids : [id];

    // console.assert(
    //   selectors.length > 0,
    //   `invalid "names" (${JSON.stringify(spec)})`
    // );

    for (const s of selectors) {
      const e = !isName
        ? _.select("#" + s, dialog)
        : applyToWrapper
        ? getWrapper(s)
        : getElement(s);
      if (!e) continue;
      if (attr === "class") {
        if (action === "set") e.setAttribute(attr, value);
        if (action === "add") e.classList.add(value);
        if (action === "remove") e.classList.remove(value);
        if (action === "toggle") e.classList.toggle(value);
        continue;
      }
      const set = !action || value === true;
      if (set) e.setAttribute(attr, value);
      const remove = action === "remove" || value === false;
      if (remove) e.removeAttribute(attr);
    }
  }
}

function createErrorElement(text) {
  const html = HTMLs["error"](text);
  return _.createElements(html);
}
function setElementAttributes(e, param) {
  for (const key in param) {
    if (isSpecial(key)) continue;
    try {
      e.setAttribute(key, param[key]);
    } catch (error) {
      console.error(`Invalid attribute in dialog: (${key}:${param[key]})`);
    }
  }
}
function createButton(param) {
  const { tag, label } = param;
  const html = HTMLs[tag](label);
  const button = _.createElements(html);
  setElementAttributes(button, param);
  return button;
}

function createSelect(param) {
  const { tag, options, name, label, value } = {
    options: ["No options"],
    ...param,
  };

  const html = HTMLs[tag](label, name);
  const div = _.createElements(html);
  const select = _.select("select", div);
  options.forEach((option) => {
    const optionEl = _.createElements({
      option: {
        text: option,
        value: option,
        selected: value === option ? "selected" : false,
      },
    });
    select.append(optionEl);
  });
  setElementAttributes(select, param);
  return div;
}
function createRadio(param) {
  const { tag, options, name, label, value } = {
    options: ["No options"],
    ...param,
  };

  const html = HTMLs[tag](label, name);
  const wrapper = _.createElements(html);
  const span = _.select("span", wrapper);
  options.forEach((option, i) => {
    const id = name + "-radio-" + i;
    const label = _.createElements({
      label: { text: option, for: id },
    });

    const checked = (value ? value === option : i === 0) ? "" : undefined;
    const input = _.createElements({
      input: { type: "radio", name, id, value: option, checked },
    });
    span.append(input);
    span.append(label);
  });

  return wrapper;
}
function createInput(param) {
  const { tag, name, label, value } = param;
  const html = HTMLs["input"](label, tag, name);
  const div = _.createElements(html);
  const input = _.select("input", div);
  input.value = value ?? "";
  setElementAttributes(input, param);
  return div;
}
function createTextArea(param) {
  const { tag, name, label } = param;
  const html = HTMLs[tag](label, name);
  const div = _.createElements(html);
  const textarea = _.select("textarea", div);
  if (param.value) {
    textarea.textContent = param.value ?? "";
  }
  setElementAttributes(textarea, param);
  return div;
}
function assertName(name, param) {
  console.assert(
    name && typeof name === "string",
    `"name" absent ${JSON.stringify(param)}`
  );
  console.assert(
    name && typeof name === "string" && !name.includes("-"),
    `hyphenated "name" ${name}`
  );
}

function createElement(param) {
  if (!param) return;

  const { tag, name, label } = param;

  if (!tag) return createErrorElement("Missing tag");

  // basic input items

  if (isInput(tag)) return createInput(param);
  if (tag == "select") return createSelect(param);
  if (tag == "button") return createButton(param);
  if (tag == "radio") return createRadio(param);
  if (tag == "textarea") return createTextArea(param);

  if (tag == "checkbox") {
    function createACheckBox(label, checked, disabled) {
      const html = HTMLs["checkbox"](label, checked, name ?? label);
      const p = _.createElements(html);
      const input = _.select("input", p);
      if (disabled) input.disabled = true;
      return p;
    }
    const div = _.createElements("div"); //document.createElement("div");
    assertName(name);
    const checked = Boolean(param.value);
    const checkEntry = createACheckBox(label, checked);
    div.appendChild(checkEntry);
    //requires a wrapper to display error message
    const wrapper = _.createElements("div");
    wrapper.append(div);
    return wrapper;
  }
  if (tag == "overlay") {
    const id = param.id;
    const overlayDiv = _.createElements({ div: { class: "overlay" } });
    if (id) overlayDiv.id = id;
    return overlayDiv;
  }
  if (tag === "object") return ObjectUi.make(param);

  if (tag === "table") return TableUi.make(param);

  if (tag === "date-select") return DateSelectUi.make(param);

  if (tag == "fieldset") {
    // assertName(name);
    const { legend, elements } = param;

    const html = HTMLs[tag](legend);
    const fieldset = _.createElements(html);
    if (elements) {
      elements.forEach((param) => {
        const { tag } = param;
        const e = isInput(tag)
          ? createInput(param)
          : tag === "select"
          ? createSelect(param)
          : tag === "textarea"
          ? createTextArea(param)
          : tag === "button"
          ? createButton(param)
          : _.createElements({ div: { text: `Unsupported tag: ${tag}` } });
        fieldset.append(e);
      });
    }
    return fieldset;
  }

  if (tag === "details") {
    const { legend, elements } = param;

    const html = HTMLs[tag](legend);
    const details = _.createElements(html);
    const detailWrapper = _.select("#detail-wrapper", details)
    if (elements) {
      elements.forEach((param) => {
        const { tag } = param;
        const e = isInput(tag)
          ? createInput(param)
          : tag === "select"
          ? createSelect(param)
          : tag === "textarea"
          ? createTextArea(param)
          : tag === "button"
          ? createButton(param)
          : _.createElements({ div: { text: `Unsupported tag: ${tag}` } });
        detailWrapper.append(e);
      });
    }
    return details;
  }

  const e = _.createElements(tag); //document.createElement(tag);
  setElementAttributes(e, param);
  if (label) e.textContent = label;
  return e;
}

function disableOnError() {
  const hasErrors = _.selectAll(".error", dialog).length > 0;
  const disableOnErrorElements = _.selectAll(".disable-on-error", dialog);
  if (hasErrors) disable(disableOnErrorElements);
  else enable(disableOnErrorElements);
  TableUi.setAllTableButtons();
}
// A110Jul2023#audi

/**
   * Processes a single error object or an array of error objects,
   * @typedef {{name: string}} OneKeyErr - has only one key value
   * @property {OneKeyErr} - the only key is used as name and value as the message
   * @typedef {{name: string, names: string[], message: string}} NamedErr - has either 'names' or 'name' as a key
   * @property {NamedErr} - If `names` is present, it will be used instead of the `name` property, and 'message' is applied to all 'names' or 'name'
   * @typedef {OneKeyErr | NamedErr} Err
   * @param {Err | Err[] } err - Single or an array of err
    
   * @property {string[]} err.names - (Optional) An array of names associated with this error.
   * If `names` is present, it will be used instead of the `name` property,
   * allowing a single error message to be applied to multiple contexts/fields.
   * @property {string} err.name - (Required if `names` is not provided) The single name
   * (e.g., field name, identifier) associated with the message.
   * @property {string} err.message - The message string to be displayed.
   * @property {string} name.message
   * @returns {void}
   *
   * @example
   * markErrors({ email: 'Invalid email format' });
   * markErrors({ name: 'email', message: 'Invalid email format' });
   * markErrors({ names: ['password', 'confirmPassword'], message: 'Passwords must match' });
   *
   */
function markErrors(errors) {
  if (!errors) {
    error();
    return;
  }
  const errs = Array.isArray(errors) ? errors : [errors];
  for (const err of errs) {
    const keys = Object.keys(err);
    if (keys.length === 1) {
      const name = keys[0];
      error(err[name], name);
      continue;
    }
    const { name, message } = err;
    const names = err.names ? err.names : [name];
    for (const name of names) error(message, name);
  }
}
function error(errorMessages, name) {
  if (!dialog) return;
  if (!errorMessages) {
    const errors = _.selectAll(".error", dialog);
    for (const error of errors) {
      error.classList.remove("error");
    }
    const errorMessages = _.selectAll(".error-message", dialog);
    for (const msg of errorMessages) msg.remove();

    hasErrors = false;
    disableOnError();
    //internalCallbacks.setAllTableButtons();
    return this;
  }
  hasErrors = true;

  if (!name) {
    const err = _.createElements(
      HTMLs["error"]("No name for: " + errorMessages)
    );
    dialog.append(err);
    disableOnError();
    return this;
  }
  const errorToDisplay = Array.isArray(errorMessages)
    ? errorMessages.join(". ")
    : errorMessages;

  const namedElement = getElement(name);
  namedElement.classList.add("error");
  const wrapperId = name + "-wrapper";
  const wrapper = _.select("#" + wrapperId, dialog); //getElement(name);
  const err = _.createElements(HTMLs["error"](errorToDisplay));
  if (wrapper) wrapper.after(err);
  else dialog.append(err);

  disableOnError();
  return this;
}

function overlay(elements, id) {
  if (!dialog) return;
  const overlayDiv = _.select(`.overlay${id ? "#" + id : ""}`, dialog);
  _.clearHTML(overlayDiv);
  if (!elements) return;
  [...elements].forEach((e) => {
    if (_.isEmptyObject(e)) return;
    const el = createElement(e);
    if (!el) return;
    overlayDiv.appendChild(el);
  });
  disableOnError();
  return this;
}
function make(
  elements,
  { callback, width = "medium", classes = "", legend = "" }
) {
  if (dialog) close();
  // if (!dialogId) {
  dialog = _.createElements(HTMLs["dialog"](legend));
  dialog.setAttribute("class", classes);
  const body = document.body;
  body.appendChild(dialog);

  if (typeof callback === "function") {
    dialog.addEventListener("change", (e) => {
      const target = e.target;

      const f = getDataCallback(target);
      if (f) f(target);

      callback({ type: "change", target });
    });

    dialog.addEventListener("click", (e) => {
      const target = e.target;
      const isButton = target.tagName.toLowerCase() === "button";
      const type = isButton ? "click-button" : "click";
      if (isButton) e.preventDefault();

      const f = getDataCallback(target);
      if (f) f(target);
      else callback({ type, target });
    });
    function getDataCallback(target) {
      const uiF = target.dataset.callback;
      if (!uiF) return;
      const [ui, functionName] = uiF.split("-");
      return ui === "tableui"
        ? TableUi[functionName]
        : ui === "objectui"
        ? ObjectUi[functionName]
        : undefined;
    }
  }
  const main = _.select("main", dialog);
  [...elements].forEach((e) => {
    if (_.isEmptyObject(e)) return;
    const element = createElement(e);
    if (!element) return;
    main.append(element);
  });

  disableOnError();
  return this;
}
function show(modal = true) {
  if (!dialog) return;
  if (dialog.open) return this;
  if (modal) dialog.showModal();
  else dialog.show();
  return this;
}

function close() {
  if (!dialog) return;
  dialog.close();
  dialog.remove();
}
function data() {
  if (!dialog) return;
  const data = {};
  const elementsWithNames = _.selectAll("[name]", dialog);
  for (const namedEl of elementsWithNames) {
    const key = namedEl.getAttribute("name");

    data[key] =
      namedEl.type === "checkbox"
        ? namedEl.checked
        : namedEl.type === "radio"
        ? data[key] ?? (namedEl.checked ? namedEl.value : undefined)
        : namedEl.dataset.type === "table" //tagName === "TABLE"
        ? TableUi.getData(namedEl, key) //getTableData(namedEl, key)
        : namedEl.dataset.type === "object"
        ? ObjectUi.getData(namedEl, key) //getObjectData(namedEl, key)
        : namedEl.value
        ? String(namedEl.value).trim()
        : "";
  }
  return data;
}

function alert(message, buttons, legend) {
  const alertElements = [{ tag: "p", label: message }, { tag: "hr" }];

  (Array.isArray(buttons) ? buttons : ["Close"]).forEach((label) => {
    if (typeof label == "string") alertElements.push({ tag: "button", label });
  });

  alertButtonPressed = "";
  make(alertElements, { legend: legend ?? "Alert", classes: "dialog" });
  show();

  const alertButtons = Array.from(_.selectAll("button", dialog));
  for (const button of alertButtons)
    button.addEventListener("click", (event) => {
      alertButtonPressed = button.textContent;
      close();
    });

  return new Promise(function (resolve, reject) {
    dialog.addEventListener("close", (event) => {
      resolve(alertButtonPressed);
    });
  });
}

const Dialog = {
  getElement,
  setElementsAttrs,
  hasErrors,
  markErrors,
  overlay,
  make,
  show,
  close,
  data,
  alert,
};

class TableUi {
  static make(param) {
    const { name, label, options, value } = param;
    const { ui } = options;

    const headers = ui.map((u) => u.label);
    const tableColumns = headers.length;
    // const html = HTMLs["table"](label, name);
    const html = `<fieldset id="${name}-outer-wrapper">
        <legend></legend>
        <details>
          <summary>${label}</summary>
          <div id="${name}-wrapper"> 
            <table id="${name}" name="${name}" data-type="table" data-inputs="">
              <thead></thead>
              <tbody></tbody>
            </table>
          </div>
          <input type="checkbox" id="${name}--" name="${name}--" data-callback="tableui-showHideEditPanel">
          <label for="${name}--">Check to show edit panel</label>
          <div id="input-group" style="display:none">
            <div id="${name}-inputs">
            </div>
            <button id="${name}-add" title="Add row" data-callback="tableui-processTableButton">&plus;</button>
            <button id="${name}-modify" title="Modify selected row" disabled data-callback="tableui-processTableButton">&check;</button>
            <button id="${name}-remove" title="Remove selected row" disabled data-callback="tableui-processTableButton">&minus;</button>
          </div>
        </details>
      </fieldset>`;
    const wrapper = _.createElements(html);
    const table = _.select("table", wrapper);

    const tr = _.createElements("tr");
    ["", ...headers].forEach((header) => {
      const th = _.createElements({ th: { text: header } });
      tr.append(th);
    });
    // console.log({ name, data, heads });
    const thead = _.select("thead", table);
    thead.append(tr);
    if (value) {
      const data = _.getArray(value);

      let rowNumber = 0;
      const tbody = _.select("tbody", table);
      for (let i = 0; i < data.length; i += tableColumns) {
        const rowdata = [];
        for (let j = 0; j < headers.length; j++) {
          rowdata.push(data[i + j]);
        }
        const tr = this.createTableRow(name, rowdata);
        tbody.append(tr);
        rowNumber++;
      }
    }
    const inputs = _.select(`#${name}-inputs`, wrapper);

    for (const u of ui) {
      const inputName = name + "-" + u.name;
      const { tag } = u;
      const input = isInput(tag)
        ? createInput({ ...u, name: inputName, value: "" })
        : createSelect({ ...u, name: inputName });
      inputs.append(input);
    }
    return wrapper;
  }
  static createTableRow(name, cellValues) {
    const tr = _.createElements("tr");
    const radioCell = _.createElements({
      td: {
        input: {
          type: "radio",
          name: `${name}-select`,
          "data-callback": "tableui-selectRowinTable",
        },
      },
    });
    tr.append(radioCell);
    cellValues.forEach((value) => {
      const td = _.createElements({ td: { text: String(value) } });
      td.setAttribute("class", `${name}-cell`);
      tr.append(td);
    });
    return tr;
  }
  static getTableComponents(name) {
    const outerWrapper = _.select(`#${name}-outer-wrapper`, dialog);
    if (!outerWrapper) return;
    const inputs = _.selectAll(
      "input, select",
      _.select(`#${name}-inputs`, outerWrapper)
    );
    const tbody = _.select("tbody", outerWrapper);
    const inputGroup = _.select("#input-group", outerWrapper);
    const inputPanel = _.select(`#${name}--`, outerWrapper);
    const tr = _.selectAll("tr", tbody).filter((row) => {
      const input = _.select("input", row);
      return input && input.checked;
    })[0];
    const values = _.selectAll("td", tr).map((td) => td.textContent);
    values.shift();

    const inputsWithError = inputs.filter((input) =>
      input.classList.contains("error")
    );
    console.log({ inputsWithError });

    const hasError = inputsWithError.length > 0;

    return { inputPanel, inputGroup, inputs, values, tr, tbody, hasError };
  }
  static selectRowinTable(e) {
    const name = e.name.split("-")[0].trim();
    const { inputs, values, tr } = TableUi.getTableComponents(name);
    if (values)
      values.forEach((v, i) => {
        inputs[i].value = v;
      });
    TableUi.setTableButtons(name);
  }
  static processTableButton(e) {
    const [name, action] = e.id.split("-");
    const { hasError, tr, inputs, tbody } = TableUi.getTableComponents(name);

    if (hasError) {
      TableUi.setTableButtons(name);
      return;
    }

    if (action === "add") {
      const cellValues = inputs.map((input) => input.value);
      const newTr = TableUi.createTableRow(name, cellValues);
      tbody.append(newTr);
    }

    if (action === "modify") {
      if (!tr) return;
      const tds = _.selectAll("td", tr);
      tds.forEach((td, i) => {
        if (i > 0) td.textContent = inputs[i - 1].value;
      });
    }

    if (action === "remove") {
      if (!tr) return;
      tr.remove();
    }
  }
  static setTableButtons(name) {
    if (!name) return;
    const addButton = _.select(`#${name}-add`);
    const modifyButton = _.select(`#${name}-modify`);
    const removeButton = _.select(`#${name}-remove`);

    disable([addButton, modifyButton, removeButton]);

    const { inputPanel, hasError, tr } = TableUi.getTableComponents(name);
    if (!inputPanel.checked) return;
    console.log({ inputPanel, hasError, tr });

    if (tr) {
      enable(removeButton);
      if (hasError) return;
      enable([addButton, modifyButton]);
      return;
    }
    if (hasError) return;
    enable(addButton);
  }
  static showHideEditPanel(e) {
    const [name] = e.id.split("-");
    const { inputPanel, inputGroup } = TableUi.getTableComponents(name);
    inputGroup.style.display = inputPanel.checked ? "block" : "none";
    TableUi.setTableButtons(name);
  }
  static setAllTableButtons() {
    const tables = _.selectAll(`[data-type="table"]`, dialog);
    tables.forEach((table) => TableUi.setTableButtons(table.name));
  }
  static getData(table, name) {
    const cells = _.selectAll(`[class="${name}-cell"`, table).map(
      (cell) => cell.textContent
    );
    console.log({ name, cells });
    return cells.join(",");
  }
}
function enable(e) {
  const elements = Array.isArray(e) ? e : [e];
  elements.forEach((element) => element.removeAttribute("disabled"));
}
function disable(e) {
  const elements = Array.isArray(e) ? e : [e];
  elements.forEach((element) => element.setAttribute("disabled", "disabled"));
}
class ObjectUi {
  static make(param) {
    const { options, value, name, label } = param;
    const { ui } = options;

    const html = `<fieldset id="${name}-outer-wrapper">
        <legend></legend>
        <details>
          <summary>${label}</summary>
          <div id="${name}" name="${name}" data-type="object"></div>
          <button id="${name}-clear" title="Clear all" data-callback="objectui-clearObject">&minus;</button>
        </details>
      </fieldset>`;

    const wrapper = _.createElements(html);
    const div = _.select("#" + name, wrapper);
    const data = _.parse(value);
    console.log({ wrapper, div, data, value });
    const prefix = name + "-";
    ui.forEach((element) => {
      const { tag, name, label } = element;
      const value = data[name];
      const id = prefix + name;
      const e = createElement({ tag, name: id, value, id, label });
      div.append(e);
    });
    return wrapper;
  }
  static clearObject(e) {
    const [name] = e.id.split("-");
    const div = _.select("#" + name, dialog);
    const inputs = _.selectAll("input, select", div);

    inputs.forEach((input) => (input.value = ""));
    console.log("clear");
  }
  static getData(wrappper, name) {
    const prefix = `${name}-`;
    const obj = {};
    _.selectAll(`[name^="${prefix}"`, wrappper).forEach((input) => {
      const key = input.name.replace(prefix, "");
      const value = input.value;
      obj[key] = value ? String(value).trim() : "";
    });
    return JSON.stringify(obj);
  }
}
class DateSelectUi {
  static make(param) {
    const { options, value, name, label } = param;
    // options: "A,B,C", value:"2025-10-01", name:"x",label:"xxx" { ui, selectOptions } = options;

    const select = "A,B,C" 
      ? `<select id="${name}-date">
        ${"A,B,C".split(",")
          .map((o) => `<option value="${o.trim()}">${o.trim()}</option>`)}
      <select>`
      : "";
          console.log({select, options})
    const html = `<div id="${name}-wrapper" class="date-select">
          <label for="${name}">${label}</label>
          <input id="${name}" name="${name}" type="text"></input>
          <input id="${name}-date" type="date"></input>
          ${select}
      </div>`;
      // add data-callback to select and date

    const wrapper = _.createElements(html);
    // const div = _.select("#" + name, wrapper);
    // const data = _.parse(value);
    // console.log({ wrapper, div, data, value });
    // const prefix = name + "-";
    // ui.forEach((element) => {
    //   const { tag, name, label } = element;
    //   const value = data[name];
    //   const id = prefix + name;
    //   const e = createElement({ tag, name: id, value, id, label });
    //   div.append(e);
    // });
    return wrapper;
  }
}
