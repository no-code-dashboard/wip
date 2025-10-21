"use strict";
import { Param } from "./param.js";
export { readFile, loadJSONFile, downloadFile };
////////// try fetch
// function tryFetch() {
//     fetch("https://reqres.in/api/users")
//         .then(response => console.log(response))
//         .catch(error => console.log({ error: error }))
// }

// function readTextFile(file) {
//     var rawFile = new XMLHttpRequest();
//     rawFile.open("GET", file, false);
//     rawFile.onreadystatechange = function () {
//         if (rawFile.readyState === 4) {
//             if (rawFile.status === 200 || rawFile.status == 0) {
//                 var allText = rawFile.responseText;
//                 console.log(allText);
//             }
//         }
//     }
//     rawFile.send(null);
// }

// function x() {
//     fetch("./json/demo.json")
//         .then((response) => response.json())
//         .then((json) => console.log(json))
// }
async function readFile(name, type) {
  const response = await fetch(name);
  if (!response.ok) return { error: "File not found" };

  const result = await response.json();
  return { result };
}
function loadJSONFile(e) {
  if (e.files && e.files[0]) {
    var myFile = e.files[0];
    var reader = new FileReader();

    reader.addEventListener("load", function (e) {
      try {
        const json = e.target.result;
        const tryParse = JSON.parse(json);
        // return json
        // $p.setConfigJSON(json);
        Param.setParam("config",tryParse)
      } catch (e) {
        const msg = `File not loaded. (${e})`;
        // console.assert(false, msg)
        $dialog.alert(msg, ["OK"]);
        return;
      }
    });
    //FileReader.readAsArrayBuffer() is recommended
    reader.readAsBinaryString(myFile);
  }
}

// function readLocalFile() {
//     var input = document.getElementById("file")
//     // input.type = "file"
//     // var body = document.getElementsByTagName("body")
//     input.setAttribute("onchange", "xxx(this)")
//     // input.addEventListener("change", function () {
//     //     if (this.files && this.files[0]) {
//     //         var myFile = this.files[0]
//     //         var reader = new FileReader()

//     //         reader.addEventListener('load', function (e) {
//     //             // output.textContent = e.target.result
//     //             console.log(e.target.result)
//     //         })

//     //         reader.readAsBinaryString(myFile)
//     //     }
//     // })
//     console.log(input)
//     input.value = ""
//     input.click()
// }

function downloadFile(data, name, type = "application/json") {
  const blob = new Blob([data], { type });
  const href = window.URL.createObjectURL(blob);
  const a = document.createElement("a");

  Object.assign(a, {
    href,
    style: "display: none",
    download: name,
  });
  document.body.appendChild(a);

  // function clickTheElement(a) {
  //     if (a.click) {
  //         a.click()
  //         return
  //     }
  //     const eventObj = document.createEvent('MouseEvents');
  //     eventObj.initEvent('click',true,true);
  //     a.dispatchEvent(eventObj);
  // }
  // clickTheElement(a)
  a.click();
  window.URL.revokeObjectURL(href);
  a.remove();
}

////////////////////////////////////////////////////// from download-csv
/////////////////////////  https://www.npmjs.com/package/download-csv?activeTab=readme

// const detectionClientType = () => { //added
// // module.exports = () => {
//     const Sys = {};
//     const ua = navigator.userAgent.toLowerCase();
//     let s;

//     (s = ua.match(/msie ([\d.]+)/)) ? Sys.ie = s[1] :
//     (s = ua.match(/firefox\/([\d.]+)/)) ? Sys.firefox = s[1] :
//     (s = ua.match(/chrome\/([\d.]+)/)) ? Sys.chrome = s[1] :
//     (s = ua.match(/opera.([\d.]+)/)) ? Sys.opera = s[1] :
//     (s = ua.match(/version\/([\d.]+).*safari/)) ? Sys.safari = s[1] : 0;

//     // 以下进行测试
//     if (Sys.ie) return { name: 'IE', version: Sys.ie };
//     if (Sys.firefox) return { name: 'Firefox', version: Sys.firefox };
//     if (Sys.chrome) return { name: 'Chrome', version: Sys.chrome };
//     if (Sys.opera) return { name: 'Opera', version: Sys.opera };
//     if (Sys.safari) return { name: 'Safari', version: Sys.safari };
//     return { name: '' };
//   }

// //const detectionClientType = require('./detectionClientType');
// const downloadFile = (csvFile, filename = 'export.csv') => {
// // module.exports = (csvFile, filename = 'export.csv') => {
//   if (!csvFile) {
//     console.log('the file is null')
//     return
//   }

//   const client = detectionClientType();
//   console.log(client)
//   const bomCode = '\ufeff';
//   let text = `data:attachment/csv;charset=utf-8,${bomCode}${encodeURIComponent(csvFile)}`;

//   if (window.Blob && window.URL && window.URL.createObjectURL) {
//     const csvData = new Blob([bomCode + csvFile], { type: 'text/csv' });
//     text = URL.createObjectURL(csvData);
//   }

//   if (client.name === 'IE') {
//     const oWin = window.top.open('about:blank', '_blank');
//     oWin.document.write(`sep=,\r\n${csvFile}`);
//     oWin.document.close();
//     oWin.document.execCommand('SaveAs', true, filename);
//     oWin.close();
//     return;
//   }

//   if (client.name === 'Safari') {
//     const link = document.createElement('a');
//     link.id = 'csvDwnLink';
//     document.body.appendChild(link);

//     const csv = bomCode + csvFile;
//     const csvData = 'data:attachment/csv;charset=utf-8,' + encodeURIComponent(csv);

//     document.getElementById('csvDwnLink').setAttribute('href', csvData);
//     // document.getElementById('csvDwnLink').setAttribute('download', filename);
//     document.getElementById('csvDwnLink').click();

//     document.body.removeChild(link);
//     // alert('文件导出成功，请修改文件后缀为 .csv 后使用');
//     return;
//   }

//   if (client.name === 'Firefox') {
//     const a = document.createElement('a');
//     a.download = filename;
//     a.target = '_blank';
//     a.href = text;

//     const event = document.createEvent('MouseEvents');
//     event.initEvent('click', true, true);
//     a.dispatchEvent(event);
//     return;
//   }

//   // chrome and other browsers
//   const a = document.createElement('a');
//   a.download = filename;
//   a.href = text;
//   a.click();
// }
function readPrivateFile() {
  function one() {
    const request = require("request");

    const URL =
      "https://raw.githubusercontent.com/myuser/myrepo/master/myfile.js";
    const TOKEN = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

    var options = {
      url: URL,
      headers: {
        Authorization: "token " + TOKEN,
      },
    };

    function callback(error, response, body) {
      console.log(response.statusCode);
      console.error(error);
      console.log(body);
    }

    request(options, callback);
  }
  async function two() {
    //https://observablehq.com/@tophtucker/fetch-csv-from-private-github-repo
    file = await fetch(
      "https://api.github.com/repos/metrics-as-a-service/Private/contents/datafiles/plan.csv",
      // `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`,
      {
        headers: {
          authorization: `token`,
          accept: "application/vnd.github.v3+json",
          ["X-GitHub-Api-Version"]: "2022-11-28",
        },
      }
    );
    console.log(file);
  }
  two();
}
