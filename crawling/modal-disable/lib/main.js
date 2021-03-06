const {Cc, Ci} = require("chrome");
var prefs = require("preferences-service");
var pageMod = require("page-mod");
const data = require("self").data;
var timers = require("jp-timers");
                     
var MODAL_POLLING_DELAY = 3000;

exports.main = function(options, callbacks) {
	
	// Disable security warnings
	var securityWarningRoot = "security.warn_";
	var securityWarningDisableList = ["entering_secure", "entering_weak", "leaving_secure", "submit_insecure", "viewing_mixed"];
	for (var i = 0; i < securityWarningDisableList.length; i++) {
		prefs.set(securityWarningRoot + securityWarningDisableList[i], false);
		prefs.set(securityWarningRoot + securityWarningDisableList[i] + ".show_once", false);
	}
	
	// Use configurable security policies to disable window.* modals
	// Disabled for now because content script approach doesn't throw security errors
	/*
	var cspWindowRoot = "capability.policy.default.Window.";
	var cspWindowDisableList = ["open", "alert", "confirm", "prompt", "onbeforeunload", "onunload"];
	for (var i = 0; i < cspWindowDisableList.length; i++)
		prefs.set(cspWindowRoot + cspWindowDisableList[i], "noAccess");
	*/
	
	// Bump the maximum script run time to prevent "unresponsive script" errors
	prefs.set("dom.max_script_run_time", 60);
	
	// Inject content script to disable window.* modals
	pageMod.PageMod({
		include: "*",
		contentScriptWhen: "start",
		contentScriptFile: data.url("content-start.js")
	});
	
	// Inject content script to disable body modals
	pageMod.PageMod({
		include: "*",
		contentScriptWhen: "end",
		contentScriptFile: data.url("content-end.js")
	});
	
	// Periodically poll for modals, see modal-dialog in mozmill-tests
	var windowMediator = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
	var modalPoll = function() {
		var windowEnumerator = windowMediator.getEnumerator('');
		while(windowEnumerator.hasMoreElements()) {
			var nextWindow = windowEnumerator.getNext();
			var nextWindowChrome = nextWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebNavigation).QueryInterface(Ci.nsIDocShellTreeItem).treeOwner.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebBrowserChrome);
			if(nextWindowChrome.isWindowModal())
				nextWindow.close();
			// Special case for unknown content type
			if(nextWindow.document != null && nextWindow.document.title.indexOf("Opening") == 0 && nextWindow.document.getElementById("unknownContentType") != null && nextWindow.document.getElementById("unknownContentType").toString() == "[object XULElement]")
				nextWindow.close();
		}
	};
	var intervalID = timers.setInterval(modalPoll, MODAL_POLLING_DELAY);
	
};