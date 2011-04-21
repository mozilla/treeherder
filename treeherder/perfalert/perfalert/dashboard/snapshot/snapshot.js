// vim: set sw=2 ts=2 sts=2 tw=78 expandtab :

// Threshold for where we want to highlight notably good
// or bad results relative to the current stable branch.
const BRANCH_THRESHOLD_GOOD =  0.02;
const BRANCH_THRESHOLD_BAD =   0.02;

// Threshold for where we want to highlight notably good
// or bad results relative to the previous week's results.
const WEEK_THRESHOLD_GOOD =  0.02;
const WEEK_THRESHOLD_BAD =   0.02;

const CURRENT_BRANCH = "Firefox3.5";

function init() {
  
  var diffs = {"Firefox": "Firefox3.5",
               "Firefox3.6": "Firefox3.5",
               "mobile-tracemonkey": "mobile"};

  var branches = [];
  var tests = [];
  var OSes = [];

  for (var branch in gData) {
    if (branches.indexOf(branch) == -1) branches.push(branch);
    for (var test in gData[branch]) {
      if (tests.indexOf(test) == -1) tests.push(test);
      for (var OS in gData[branch][test]) {
        if (OS == "_testid") continue;
        if (OSes.indexOf(OS) == -1) OSes.push(OS);
      }
    }
  }

  // build tables
  var testEl = document.getElementById("tests");
  tests.forEach(function(aTest) {
    var m = "<div class='testDiv'>";
    m += "<h1>" + aTest + "</h1>";
    m += "<table class='testTable'>";
    m += "<tr><td></td>";
    branches.forEach(function(aBranch) {
      m += "<td>" + aBranch + "</td>";
    });
    m += "</tr>";
    OSes.forEach(function(aOS) {
      m += "<tr>";
      m += "<td>" + aOS + "</td>";
      branches.forEach(function(aBranch) {

        try {
          var s = getSummary(aBranch, aOS, aTest);

          m += "<td>" +
            "Median: <span class='rightval'>" + s.median + "</span>" +
            "<br>Deviation: <span class='rightval'>" + s.deviation + "</span>" +
            "<br>Mean: <span class='rightval'>" + s.mean + "</span>";

          // weekly diff 
          if (s.weekDifferenceMean != undefined) {
            var cellStyle= "";
            // TODO: fix the difference from last week within the level of noise
            //var isWithinNoise = s.deviation/s.mean > Math.abs(s.weekDifferenceMean);
            var isWithinNoise = true;

            m += " <br>From last week:&nbsp;";
            if (!isWithinNoise) {
              m += "<span class='rightval'>too noisy</span>";
            }
            else {
              var resultClass = "";
              if (isWithinNoise && s.weekDifferenceMean >= WEEK_THRESHOLD_GOOD) {
                resultClass = "good";
              }
              else if (isWithinNoise && s.weekDifferenceMean <= -WEEK_THRESHOLD_BAD) {
                resultClass = "bad";
              }
              m += "<span class='rightval " + resultClass + "'>" + Math.floor(s.weekDifferenceMean * 100) + "%</span>";
            }
          }

          // branch diff
          if (s.fxcurrentDifferenceMean != undefined) {
            var cellStyle= "";
            // TODO: fix the difference from stable branch within the level of noise
            //var isWithinNoise = s.deviation/s.mean > Math.abs(s.fxcurrentDifferenceMean);
            var isWithinNoise = true;

            m += " <br>From " + CURRENT_BRANCH + ":&nbsp;";
            if (!isWithinNoise) {
              m += "<span class='rightval'>too noisy</span>";
            }
            else {
              var resultClass = "";
              if (s.fxcurrentDifferenceMean >= BRANCH_THRESHOLD_GOOD) {
                resultClass = "good";
              }
              else if (s.fxcurrentDifferenceMean <= -BRANCH_THRESHOLD_BAD) {
                resultClass = "bad";
              }
              m += "<span class='rightval " + resultClass + "'>" + Math.floor(s.fxcurrentDifferenceMean * 100) + "%</span>";
            }
          }

          m += "</td>";
        } catch(ex) {
          m += "<td> " + "---" + "</td>";
        }
      });
      m += "</tr>";
    });
    m += "</table></div>";
    testEl.innerHTML += m;
  });

  // footer
  document.getElementById("fetchtimetext").textContent = "Data pulled: " + gFetchTime;
}

/**
 * Given a branch, OS and test name, this function
 * returns an object containing statistics about performance 
 * across the most recent result from all machines that
 * had data.
 * 
 * eg: getSummary("Firefox", "Leopard", "Ts")
 * 
 * would return the median startup time, average startup time,
 * variance, standard deviation, difference from the previous week
 * and difference from the current stable release (currently the 3.5
 * branch):
 * 
 * {
 *   median: 1234,
 *   mean: 5678,
 *   variance: 5678,
 *   deviation: 5678,
 *   weekDifference: 0.24
 *   fxcurrentDifference: 0.24
 * }
 *
 * Branches: Firefox, Firefox3.5, Firefox3.6, Places
 *           TraceMonkey, mobile, mobile-1.9.2, mobile-tracemonkey
 *
 * Tests:    SVG, Tp4, Tp4 (RSS), Tp4 Shutdown, Ts, Ts Shutdown
 *           "Ts Shutdown, Cold", "Ts, Cold", Txul
 *
 * OSes:     Leopard, Linux, Vista, XP
 *
 */
function getSummary(aBranch, aOS, aTest) {
  //document.write(aBranch + ", " + aOS + ", " + aTest + "<br>");
  if (!gData[aBranch] || !gData[aBranch][aTest] ||
      !gData[aBranch][aTest][aOS])
    throw("Invalid parameters!");

  var machines = gData[aBranch][aTest][aOS];
  var beginning = [];
  var end = [];

  for (var machine in machines) {
    if (machine == "_graphURL" || machine == "_platformid")
      continue;
    var data = machines[machine].results;
    beginning.push(data[1]);
    end.push(data[data.length-1]);
  }

  beginning.sort();
  end.sort();

  //document.write(beginning + "<br>");
  var bs = getStatistics(beginning);
  var es = getStatistics(end);
  //document.write(bs.mean + " -> " + es.mean + "<br>");

  es.weekDifferenceMean = Math.round(((bs.mean - es.mean)/bs.mean) * 100)/100;
  //document.write(es.weekDifferenceMean + "<br>");

  if (aBranch != CURRENT_BRANCH) {
    var currentSummary = getSummary(CURRENT_BRANCH, aOS, aTest);
    es.fxcurrentDifferenceMean = Math.round(((currentSummary.mean - es.mean)/currentSummary.mean)*100)/100;
  }
  return es;
}

/**
 * Returns an object that contains the median, mean,
 * variance and standard deviation for an array of numbers.
 */
function getStatistics(a) {
  var r = {
    median:   0,
    mean:     0,
    deviation: 0,
    variance: 0
  };

  if (a.length > 1) {
    a.sort();

    // median
    var mid = Math.floor(a.length / 2);
    r.median = Math.floor(((a.length % 2) != 0) ?
      a[mid] : (a[mid - 1] + a[mid]) / 2);

    // mean
    r.mean = Math.floor(a.reduce(function(total, val) {
      return total += val;
    })/a.length);

    // variance
    r.variance = Math.floor(a.reduce(function(total, val) {
      var diff = val - r.mean;
      return total += diff * diff;
    })/a.length);

    // standard deviation
    r.deviation = a.length == 1 ? 0 : Math.floor(Math.sqrt(r.variance));
  }
  else
    r.median = a[0];

  return r;
}
