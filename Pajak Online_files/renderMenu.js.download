/*======================*/
/*                      */
/*    Rendering Menu    */
/*                      */
/*======================*/

/*--------------*/
/* Event manage */
/*--------------*/

// Add event
function addEvent(obj, type, fn) {
	if (obj.attachEvent) {
		obj['e' + type + fn] = fn;
		obj[type+fn] = function() {
			obj['e' + type + fn] (window.event);
		}
		obj.attachEvent('on' + type, obj[type + fn]);
	} else {
		obj.addEventListener( type, fn, false);
	}
}

// Remove event
function removeEvent(obj, type, fn) {
	if (obj.detachEvent) {
		obj.detachEvent('on' + type, obj[type + fn] );
		obj[type + fn] = null;
	} else {
		obj.removeEventListener(type, fn, false);
	}
}

/*--------------------*/
/* Application change */
/*--------------------*/

// Change application from select menu
function changeApp(appId, moduleId) {
	// Get application selected
	var appSelect = document.getElementById('app-select');
	var app = appSelect.value;
	
	// If same application selected, do nothing
	if (app == appId) {
		appSelect.value = "0";
		appSelect.blur();
		return;
	}
	
	// Hide content
	var content = document.getElementById('content');
	if (content != null) {
		content.style.display = 'none';
	}
	
	// Show loading text
	var loadingText = document.getElementById('loadingText');
	if (loadingText != null) {
		loadingText.style.display = 'inline';
	}

	// Redirect to selected application
	if (app != '0') {
		var url = Base64.encode('a=' + app);
		window.location.href = 'main.php?param=' + url;
	}
}

// Show application select
function showSelectApp() {
	document.getElementById('app-select').style.display = 'inline';
	document.getElementById('app-link').style.display = 'none';
	document.getElementById('app-select').focus();
}

// Hide application select
function hideSelectApp() {
	document.getElementById('app-select').style.display = 'none';
	document.getElementById('app-link').style.display = 'inline';
}

// Select application
function selectSelectApp() {
	var valueSelectApp = document.getElementById('app-select').value;
	hideSelectApp();
	removeEvent(document.getElementById('app-select'), 'blur', selectSelectApp);
}

// Focus on application select
function focusSelectApp() {
	addEvent(document.getElementById('app-select'), 'blur', selectSelectApp);
}

/*---------------*/
/* Module change */
/*---------------*/

// Change module from select menu
function changeModule(app) {
	// Hide content
	var content = document.getElementById('content');
	if (content != null) {
		content.style.display = 'none';
	}
	
	// Show loading text
	var loadingText = document.getElementById('loadingText');
	if (loadingText != null) {
		loadingText.style.display = 'inline';
	}

	// Redirect to selected module
	var selectModule = document.getElementById('module-select');
	var module = selectModule.value;
	if (module != '0') {
		var url = Base64.encode('a=' + app + '&m=' + module);
		window.location.href = 'main.php?param=' + url;
	}
}

// Show module select
function showSelectModule() {
	document.getElementById('module-select').style.display = 'inline';
	document.getElementById('module-link').style.display = 'none';
	document.getElementById('module-select').focus();
}

// Hide module select
function hideSelectModule() {
	document.getElementById('module-select').style.display = 'none';
	document.getElementById('module-link').style.display = 'inline';
}

// Select module
function selectSelectModule() {
	var valueSelect = document.getElementById('module-select').value;
	hideSelectModule();
	removeEvent(document.getElementById('module-select'), 'blur', selectSelectModule);
}

// Focus on module select
function focusSelectModule() {
	addEvent(document.getElementById('module-select'), 'blur', selectSelectModule);
}
