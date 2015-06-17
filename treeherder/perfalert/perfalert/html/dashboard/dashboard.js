// vim: set sw=2 ts=2 sts=2 tw=78 expandtab :
DEFAULT_TREE = "Firefox";
gDataUrlBase = "http://graphs.mozilla.org/server/getdata.cgi?";

// We use Math.floor all the time
const fl = Math.floor;

function init() {

  parseArgs();
  
  // Which tree are we monitoring?
  gTree = gArgs["tree"] || DEFAULT_TREE;
  gTests = gData[gTree];
  buildTreesHeaderAndFooter();
  
  buildAllGraphs();
  
  document.getElementById("fetchtimetext").textContent = "Data pulled: " + gFetchTime;
}

function buildAllGraphs() {
  
  var topLevelDiv = document.getElementById("tests");
  
  for (test in gTests) {
    var testDiv = document.createElement("div");
    var test_id = String(gTests[test]._testid);
    testDiv.setAttribute("class", "testdiv");
    testDiv.setAttribute("id", test_id);
    
    var header = document.createElement("h1");
    header.textContent = nicename(test);
    testDiv.appendChild(header);
    
    topLevelDiv.appendChild(testDiv);
    
    for (platform in gTests[test]) {
      // Skip _fields, since those aren't results, they're metadata
      if (platform.charAt(0) === '_')
        continue;
      var wrapperDiv = document.createElement("div");
      var platform_id = String(gTests[test][platform]._platformid);
      wrapperDiv.setAttribute("class", "platformdivwrapper");
      wrapperDiv.setAttribute("id", platform_id + "-" + test_id + "wrapper");
      testDiv.appendChild(wrapperDiv);
      
      var h2 = document.createElement("h2");
      h2.textContent = nicename(platform);
      wrapperDiv.appendChild(h2);
      
      // Construct the link to the real graph server
      var a = document.createElement("a");
      a.href = gTests[test][platform]._graphURL;
      a.title = "Click for full graph server on these data sets"
      wrapperDiv.appendChild(a);
      
      // Construct the graph with flot
      var flotDiv = document.createElement("div");
      flotDiv.setAttribute("class", "platformdiv");
      flotDiv.setAttribute("id", platform_id+"-"+test_id);
      a.appendChild(flotDiv);
      buildGraphForSet(test, platform);
    }
  }
}

function buildGraphForSet(test, platform) {
  
  var results = gTests[test][platform];

  var test_id = String(gTests[test]._testid);
  var platform_id = String(gTests[test][platform]._platformid);

  var d = new Date();
  d.setDate(d.getDate()-7);
  var sevenDaysAgo = d.valueOf() / 1000;

  var min = Infinity;
  var max = 0;
  var seriesCount = 0;
  
  var plotSeries = [];
  
  for(r in results) {
    // Skip _fields, since those aren't results, they're metadata
    if (r.charAt(0) === '_')
      continue;
    
    var boxresults = results[r];
    
    // Skip valid boxes that aren't returning results
    if(!boxresults.results.length)
      continue;
    
    seriesCount++;
    
    max = fl(Math.max(max, boxresults.stats[1]));
    min = fl(Math.min(min, boxresults.stats[2]));

    // data is given timestamp1,data1,timestamp2,data2... which is
    // almost how flot wants it, [[time1,data1],[time2,data2]]
    var rawresults = [];
    for(i = 0; i < boxresults.results.length; i += 2) {
      rawresults.push([ boxresults.results[i]*1000, boxresults.results[i+1] ]);
    }
    plotSeries.push({
      //color: color or number,
      //label: string,
      lines: {
        lineWidth: 1
      },
      //bars: specific bars options,
      //points: specific points options,
      //xaxis: 1,
      //yaxis: 1,
      shadowSize: 2,
      data: rawresults
    });
  }
  
  $.plot($("#" + platform_id + "-" + test_id), plotSeries, {
    xaxis : {
      mode: "time",
      tickSize: [1, "day"],
      timeformat: "%m/%d",
      min: Date.now() - 86400*7*1000,
      max: Date.now()
    },
    yaxis : {
      min: 0.8 * min,
      max: 1.2 * max
    },
    grid : {
      borderWidth: 0.2
    }
  });
}

/**
 * Map ugly names to nice ones
 */
function nicename (uglyname) {
  switch (uglyname.toUpperCase()) {
    case "TS" :
      return "Ts - Browser Startup Time (ms)"
    case "TS SHUTDOWN" :
      return "Ts Shutdown - Browser Shutdown Time after Ts test (ms)"
    case "TXUL" :
      return "Txul/Twinopen - New Window Creation Time (ms)"
    case "TP3" :
      return "Tp3 - Average Page Load Time (ms)"
    case "TP3 (RSS)" :
      return "Tp_RSS/Working Set - Memory usage during Tp runs (bytes)";
    case "TP3 SHUTDOWN" :
      return "Tp3 Shutdown - Browser Shutdown Time after Tp3 test (ms)";
    case "SVG" :
      return "Tsvg - SVG Rendering Speed"
    default :
      return uglyname;
  }
}

function parseArgs() {
  gArgs = {};
  
  // Loop over the args passed in, if any.
  var pairs = content.location.search.slice(1).split("&");
  for(pair in pairs) {
    var name, value;
    [name, value] = pairs[pair].split('=');
    gArgs[name] = value;
  }
}

function buildTreesHeaderAndFooter() {
  
  // First, update the "current tree" text in each place
  document.getElementById("header").textContent = nicename(gTree);
  document.title = nicename(gTree) + " - " + document.title;
  document.getElementById("currenttree").textContent = nicename(gTree);
  
  var otherTrees = document.getElementById("othertrees");
  for(tree in gData) {
    if(tree === gTree) // Skip the current tree
      continue;
    
    // Remember the params we were given, just "fix" the tree, then
    // build a URL out of it
    var argString = "?";
    for (arg in gArgs) {
      if(arg != "tree" && gArgs[arg])
        argString += arg + "=" + gArgs[arg] + "&";
    }
    if (tree != DEFAULT_TREE)
      argString += "tree=" + tree;
    
    var a = document.createElement("a");
    a.textContent = nicename(tree);
    a.href = argString;
    otherTrees.appendChild(a);
    
    otherTrees.appendChild(document.createTextNode("   "));
  }
}
