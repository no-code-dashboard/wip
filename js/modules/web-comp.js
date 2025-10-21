"use strict";
import { _ } from "./util.js";
export { registerComponents };
function registerComponents() {
  customElements.define("date-input", DateAndSelectComponent);
}

/**
 * claude prompt
 * you are a javascript expert. write js code to create a web component as follows:
 * if will have text display, date input, select, button to dropdown the date and another button to dropdown select options
 * the date input and select will always be invisible. Only the calendar portion or options become visible when corrosponding button is clicked
 * when either the date or select changes the test dsplay will show the value, date will be shown as yyyy-mm-dd
 * If value is provided then if valid date or valid option text display should be updated
 * if options are provided they should be used as select options, else diasble button to select
 * options will be a comma separeted list e.g. options="A,B,C"
 * 
 */


/**
 * A custom web component that displays text, and allows selection via a hidden date input and a hidden select dropdown,
 * controlled by separate buttons.
 *
 * Attributes:
 * - value: Initial value to display. If it's a valid date (YYYY-MM-DD) or an option, the display updates.
 * - options: A comma-separated list of values for the select dropdown (e.g., "A,B,C").
 */
class DateAndSelectComponent extends HTMLElement {
    constructor() {
        super();
        // Create a shadow root
        this.attachShadow({ mode: 'open' });

        // Bind 'this' for methods used as event listeners
        this.handleDateChange = this.handleDateChange.bind(this);
        this.handleSelectChange = this.handleSelectChange.bind(this);
        this.toggleDateDropdown = this.toggleDateDropdown.bind(this);
        this.toggleSelectDropdown = this.toggleSelectDropdown.bind(this);

        this.render();
    }

    // Define which attributes to observe for changes
    static get observedAttributes() {
        return ['value', 'options'];
    }

    // Handle attribute changes
    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            if (name === 'options') {
                this.updateOptions(newValue);
            } else if (name === 'value') {
                this.updateDisplay(newValue);
            }
        }
    }

    // Called when the element is inserted into a document
    connectedCallback() {
        // Initial setup
        this.updateOptions(this.getAttribute('options'));
        this.updateDisplay(this.getAttribute('value'));

        // Attach event listeners
        this.$dateInput.addEventListener('change', this.handleDateChange);
        this.$select.addEventListener('change', this.handleSelectChange);
        this.$dateButton.addEventListener('click', this.toggleDateDropdown);
        this.$selectButton.addEventListener('click', this.toggleSelectDropdown);
    }

    // Called when the element is removed from a document
    disconnectedCallback() {
        // Remove event listeners to prevent memory leaks
        this.$dateInput.removeEventListener('change', this.handleDateChange);
        this.$select.removeEventListener('change', this.handleSelectChange);
        this.$dateButton.removeEventListener('click', this.toggleDateDropdown);
        this.$selectButton.removeEventListener('click', this.toggleSelectDropdown);
    }

    // Renders the initial structure and styles
    render() {
        const shadow = this.shadowRoot;

        // --- CSS Styles ---
        const style = document.createElement('style');
        style.textContent = `
            :host {
                display: inline-block;
                border: 1px solid #ccc;
                padding: 10px;
                font-family: Arial, sans-serif;
                border-radius: 4px;
            }
            .container {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .display-text {
                font-weight: bold;
                flex-grow: 1;
                padding: 4px;
                min-width: 150px;
                border: 1px solid #eee;
                border-radius: 2px;
                background-color: #f9f9f9;
            }
            .input-wrapper {
                position: relative;
            }
            /* Styling the native elements to be invisible but functional for their dropdowns */
            input[type="date"], select {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                opacity: 0; /* Make them invisible */
                cursor: pointer; /* Keep cursor to indicate interactivity */
                z-index: 10;
                /* Crucial: remove native appearance to ensure only the dropdown/calendar appears */
                appearance: none;
                -webkit-appearance: none;
                -moz-appearance: none;
                border: none;
                padding: 0;
                margin: 0;
                /* mods */
                opacity: 1;
                
            }
            /* The buttons will trigger the native dropdowns */
            button {
                padding: 5px 10px;
                cursor: pointer;
                border: 1px solid #007bff;
                background-color: #007bff;
                color: white;
                border-radius: 3px;
                transition: background-color 0.2s;
                /* mods */
                background-color: transparent; 
            }
            button:hover:not(:disabled) {
                background-color: #0056b3;
            }
            button:disabled {
                background-color: #cccccc;
                cursor: not-allowed;
            }
        `;
        shadow.appendChild(style);

        // --- HTML Structure ---
        const container = document.createElement('div');
        container.classList.add('container');

        // 1. Text Display
        this.$displayText = document.createElement('span');
        this.$displayText.classList.add('display-text');
        this.$displayText.textContent = ''//mod: 'No value selected';
        container.appendChild(this.$displayText);

        // 2. Date Button and Input Wrapper
        const dateWrapper = document.createElement('div');
        dateWrapper.classList.add('input-wrapper');
        dateWrapper.style.width = 'fit-content'; // Tightly wrap the button

        this.$dateButton = document.createElement('button');
        this.$dateButton.textContent = ''//mod '📅 Date';
        dateWrapper.appendChild(this.$dateButton);

        this.$dateInput = document.createElement('input');
        this.$dateInput.setAttribute('type', 'date');
        // The date input needs to be positioned over the button to receive the click,
        // which then triggers its native calendar/dropdown.
        // We'll use the 'toggleDateDropdown' to focus it instead, which is more reliable.
        dateWrapper.appendChild(this.$dateInput);
        container.appendChild(dateWrapper);

        // 3. Select Button and Input Wrapper
        const selectWrapper = document.createElement('div');
        selectWrapper.classList.add('input-wrapper');
        selectWrapper.style.width = 'fit-content';

        this.$selectButton = document.createElement('button');
        this.$selectButton.textContent = '▼ Option';
        selectWrapper.appendChild(this.$selectButton);

        this.$select = document.createElement('select');
        // Similar to the date input, we place the select element to be focusable/clickable.
        selectWrapper.appendChild(this.$select);
        container.appendChild(selectWrapper);

        shadow.appendChild(container);
    }

    // --- Helper Methods ---

    /**
     * Updates the text display with a new value if it's a valid date or a valid option.
     * @param {string | null} newValue The value to try and display.
     */
    updateDisplay(newValue) {
        if (!newValue) {
            this.$displayText.textContent = 'No value selected';
            return;
        }

        let isValid = false;
        
        // 1. Check if it's a valid date (YYYY-MM-DD format)
        // Simple regex check for YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(newValue)) {
            // Further check if it's an actual, parseable date
            const date = new Date(newValue);
            if (!isNaN(date) && date.toISOString().slice(0, 10) === newValue) {
                 this.$displayText.textContent = newValue;
                 this.$dateInput.value = newValue; // Sync the date input
                 isValid = true;
            }
        }

        // 2. Check if it's a valid option
        const options = Array.from(this.$select.options).map(o => o.value);
        if (options.includes(newValue)) {
            this.$displayText.textContent = newValue;
            this.$select.value = newValue; // Sync the select
            isValid = true;
        }

        if (isValid) {
            this.setAttribute('value', newValue); // Sync attribute back
        } else {
             // If the attribute was set, but it's not valid, don't change the display,
             // but if the display is empty, set a fallback.
             if (this.$displayText.textContent === 'No value selected') {
                 this.$displayText.textContent = 'Invalid initial value';
             }
        }
    }

    /**
     * Populates the select element with options from a comma-separated string.
     * @param {string | null} optionsString Comma-separated options string.
     */
    updateOptions(optionsString) {
        // Clear existing options
        this.$select.innerHTML = '';

        if (!optionsString) {
            this.$selectButton.disabled = true;
            return;
        }

        this.$selectButton.disabled = false;

        const optionsArray = optionsString.split(',').map(s => s.trim()).filter(s => s.length > 0);

        // Add a default blank/placeholder option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select an option';
        this.$select.appendChild(defaultOption);

        optionsArray.forEach(optionText => {
            const option = document.createElement('option');
            option.value = optionText;
            option.textContent = optionText;
            this.$select.appendChild(option);
        });

        // Re-validate the current display/value against the new options
        this.updateDisplay(this.getAttribute('value'));
    }

    // --- Event Handlers ---

    handleDateChange(event) {
        const selectedDate = event.target.value; // Date is already in yyyy-mm-dd format
        this.updateDisplay(selectedDate);
    }

    handleSelectChange(event) {
        const selectedValue = event.target.value;
        this.updateDisplay(selectedValue);
    }

    /**
     * The trick to opening the native date picker programmatically is to focus the hidden input.
     * This relies on modern browser behavior.
     */
    toggleDateDropdown() {
        this.$dateInput.focus();
        // this.$dateInput.showPicker();
        // In some browsers (like Chrome), focusing the date input is enough to open the calendar.
        // For others, a subsequent click or use of `showPicker()` (if supported) might be needed.
        // For maximum compatibility and simplicity in a Web Component, `focus()` is the standard approach.
    }

    /**
     * Similarly, focusing the select element often triggers its dropdown menu.
     */
    toggleSelectDropdown() {
        if (!this.$selectButton.disabled) {
            this.$select.focus();
            // A subsequent click might be required for some browsers, but focusing is the most reliable JS method.
        }
    }
}