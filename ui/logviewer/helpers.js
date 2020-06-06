// This file is for spitting out something nicely formatted from the Talos logs.
// This code is taken from https://github.com/gregtatum/scripts/blob/master/mochitest-formatter/from-talos-log.js
const x256 = require('x256');

function output(line, color) {
  line = line.replace(/^\d+ INFO/, '⎮ ');
  return `${`${color + line}\x1b[00m`}\n`;
}

function fromHex(s) {
  return parseInt(s, 16);
}

function parseHex(s) {
  const xs = s.replace(/^#/, '').match(/\w{2}/g);
  const res = [];
  for (let i = 0; i < xs.length; i++) {
    res.push(fromHex(xs[i]));
  }
  return res;
}

function hexCode(colour) {
  const colours = {
    red: '#ff0000',
    green: '#008000',
    blue: '#0000ff',
  };
  if (typeof colours[colour.toLowerCase()] !== 'undefined')
    return colours[colour.toLowerCase()];

  return false;
}

function parseColor(rgb) {
  if (typeof rgb === 'string' && /,/.test(rgb)) {
    rgb = rgb.split(',');
  } else if (typeof rgb === 'string' && /^#/.test(rgb)) {
    rgb = parseHex(rgb);
  } else if (typeof rgb === 'string') {
    rgb = hexCode(rgb);
    if (rgb) rgb = parseHex(rgb);
    else rgb = [127, 127, 127];
  }
  return `\x1b[38;5;${x256(rgb)}m`;
}

function color(parts) {
  if (typeof parts === 'string') parts = parts.split(/\s+/);
  if (typeof parts === 'object' && /^\d+$/.test(parts[0])) {
    parts = [parts];
  }

  let s = '';
  for (let i = 0; i < parts.length; i++) {
    const c = {
      bright: 1,
      dim: 2,
      underscore: 4,
      blink: 5,
      reverse: 7,
      hidden: 8,
    }[parts[i]];

    if (c) s += `\x1b[${c}m`;
    else s += parseColor(parts[i]);
  }
  return s;
}

const PASS_COLOR = color('green');
const START_COLOR = color('blue');
const FAIL_COLOR = color('red');
const OTHER_COLOR = color('yellow');
const DIM_COLOR = color(['dim', [91, 127, 127]]);
const INFO_COLOR = color(['bright', [91, 127, 127]]);
const SUMMARY_COLOR = color(['bright', [255, 255, 255]]);
const DEBUG_COLOR = color(['bright', [255, 0, 255]]);

export default function logFormatter(log) {
  if (/INFO - GECKO\(\d+\)/.test(log)) {
    // Do nothing
  } else if (/INFO - TEST-(OK)|(PASS)/.test(log))
    return output(log, PASS_COLOR);
  else if (/INFO - TEST-UNEXPECTED-FAIL/.test(log))
    return output(log, FAIL_COLOR);
  else if (/INFO - TEST-START/.test(log)) return output(log, START_COLOR);
  else if (/INFO - TEST-/.test(log)) return output(log, OTHER_COLOR);
  else if (/!!!/.test(log)) return output(log, DEBUG_COLOR);
  else if (/Browser Chrome Test Summary$/.test(log))
    return output(log, SUMMARY_COLOR);
  else if (/((INFO -)|([\s]+))(Passed|Failed|Todo):/.test(log))
    return output(log, SUMMARY_COLOR);
  else if (/INFO/.test(log)) {
    return output(log, INFO_COLOR);
  } else {
    return output(log, DIM_COLOR);
  }
}
