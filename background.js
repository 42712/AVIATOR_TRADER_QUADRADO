chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("keepAlive", { periodInMinutes: 1 });
  console.log("[BG] Extensão Sortenabet iniciada");
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "keepAlive") {
    console.log("[BG] Alive");
  }
});

setInterval(() => {
  fetch("http://localhost:8000/api/nova-vela", { method: "POST", headers: {"Content-Type":"application/json"}, body: "{}" }).catch(() => {});
}, 4 * 60 * 1000);