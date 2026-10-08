(function () {
  'use strict';
  var stage = document.getElementById('p3ThermoStage');
  var thermometer = document.getElementById('p3Thermo');
  var lab = document.getElementById('p3FormationLab');
  if (!stage || !thermometer || !lab) return;
  var mercury = document.getElementById('p3Mercury');
  var temperature = document.getElementById('p3Temp');
  var label = document.getElementById('p3ThermoValue');
  var value = 20, dragging = false;
  function setTemperature(next) {
    value = Math.max(20, Math.min(30, next));
    var text = value.toFixed(1);
    mercury.style.height = (18 + (value - 20) * 6.6) + '%';
    temperature.textContent = text + '°C';
    label.textContent = '摄氏度：' + text + '°';
    thermometer.setAttribute('aria-valuenow', text);
    thermometer.setAttribute('aria-valuetext', text + '摄氏度');
    thermometer.classList.toggle('hot', value >= 26.5);
  }
  function updateFromPointer(event) {
    var rect = thermometer.getBoundingClientRect();
    setTemperature(20 + (1 - (event.clientY - rect.top - rect.height * .16) / (rect.height * .66)) * 10);
  }
  function enterLab() {
    if (value < 26.5) return;
    stage.hidden = true;
    lab.hidden = false;
    lab.focus({ preventScroll:true });
  }
  thermometer.addEventListener('pointerdown', function (event) {
    if (!event.isPrimary || event.button !== 0) return;
    dragging = true;
    thermometer.setPointerCapture(event.pointerId);
    updateFromPointer(event);
  });
  thermometer.addEventListener('pointermove', function (event) {
    if (dragging && thermometer.hasPointerCapture(event.pointerId)) updateFromPointer(event);
  });
  thermometer.addEventListener('pointerup', function (event) {
    if (!dragging || !thermometer.hasPointerCapture(event.pointerId)) return;
    updateFromPointer(event);
    dragging = false;
    thermometer.releasePointerCapture(event.pointerId);
    enterLab();
  });
  thermometer.addEventListener('pointercancel', function () { dragging = false; });
  thermometer.addEventListener('keydown', function (event) {
    var next;
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') next = value + .5;
    else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') next = value - .5;
    else if (event.key === 'Home') next = 20;
    else if (event.key === 'End') next = 30;
    else return;
    event.preventDefault();
    setTemperature(next);
    enterLab();
  });
  function reset() {
    dragging = false;
    stage.hidden = false;
    lab.hidden = true;
    setTemperature(20);
  }
  window.TyphoonTemperature = { reset:reset };
  reset();
}());
