/*
======================================================================
myAnalytics v0.1
By: Sergio García [https://github.com/secasema/myanalytics]

Please note that this is not meant to be a standalone script, instead
it is meant to be used with the html view. I do know that the callback
functions can be separated from the logic and thus the code can be
modified to be standalone, but I just decided not to, as it was not in
my original plans to release this to the world.

(Still, you are very much encouraged to tweak the code to fit your
very own needs and purpose :D)

Distributed under the MIT License
======================================================================
*/

//TO-DO sometime: - csv exports (maybe even xlsx export)
//                - proper documentation (lol :P)

//Global request variables (retrieved from page)
var req_entity = 1589;
var req_start_date,req_end_date;
var access_token;

var eys_array = []; //An array containing all entities retrieved by the script

//Constants used by EXPA's API v2
//  ->type = ["opportunity"|"person"] (Corresponding to ICX and OGX respectively)
//  ->programme = [1|2] (Corresponding to GC and GT respectively)
const names = Object.freeze({
	iGT: {"type" : "opportunity", "programme": 2},
	oGT: {"type" : "person", "programme": 2},
	iGV: {"type" : "opportunity", "programme": 1},
	oGV: {"type" : "person", "programme": 1},
	iGE: {"type" : "opportunity", "programme": 5},
	oGE: {"type" : "person", "programme": 5},
});

var retrieved = {
	"iGT" : 0,
	"oGT" : 0,
	"iGV" : 0,
	"oGV" : 0,
	"iGE" : 0,
	"oGE" : 0,
	"name" : 0,
}
var error = false;
access_token = getCookie("access_token");

/*
======================================================================
      Main function. To be loaded when on document 'ready' event      
======================================================================
*/

$(function(){
	//Pre-loads default settings
	presetDate("thisyear");

	//Looks for an existent token from cookies
	if(getCookie("access_token")) {
		$("#atoken").val(getCookie("access_token")); //Gets the cookie, even if invalid
		//TO-DO: Check with API whether token is still valid and not use it in that case
	}

	//Submit an analytics request
	analyticsreq();

	//Attach an event handler when Submit button gets a new request
	$("#submitbtn").click(function (){
		analyticsreq(); //Submit an analytics request
	});

	//TO-DO: Either respond to "GET" analytics requests, or attach event to "Enter" keystroke
});

/*
======================================================================
                         Auxiliary functions                          
======================================================================
*/


/* 
 * cleanup
 *  
 * Description:
 * Cleans up all variables in order for a new request to take place
 * 
 */

function cleanup(){
	eys_array = []; //Garbage collector will take care of all the detached objects
	retrieved = {
		"iGT" : 0,
		"oGT" : 0,
		"iGV" : 0,
		"oGV" : 0,
		"iGE" : 0,
		"oGE" : 0,
		"name" : 0,
	};

	document.getElementById("results").tBodies[0].innerHTML = ""; //Cleans up table rows except for headers
	$("th[data-sorted='true']").removeAttr("data-sorted-direction")
	$("th[data-sorted='true']").attr('data-sorted','false');
	Sortable.init(); //External Sortable library from Hubspot
}


/* 
 * generalreq
 *  
 * Description:
 * Performs GET request with the specified callback. Failures are handled as a general feature
 * 
 * @params: {string} url - The url to be used for the GET HTTP request
 * @params: {Object} params - The parameters to be send alongside the url
 * @params: {callback} callback - The callback function to be called upon success
 */

function generalreq(url,params,callback) {
	$.get(url,params,callback).fail(function(xhr){
		//Handle errors depending on status code

		if(xhr.status == 401) { //Unauthorized
			$('#statusbar').html("Access token is invalid. Try again with another one.");
			setCookie("access_token","",-1);
		}
		else { //Every other error (mostly 404, EXPA seems to like 404 errors a lot)
			$('#statusbar').html("EXPA hates you, thus your request failed :C Please try again.");
		}
		error = true;
	});
}

/* 
 * analyticsreq
 *  
 * Description:
 * Triggers analytics request for the children of the specified entity.
 */

function analyticsreq(){
	//console.log("New Analytics Request"); //Uncomment for debug

	//Get variable values from the HTML Form
	//TO-DO: Maybe add some validation (?) [Not sure how necessary though]
	req_entity = $("#ey").val();
	req_start_date = $("#fini").val();
	req_end_date = $("#ffin").val();
	aux_token = $("#atoken").val();
	if(aux_token != ""){ //Check's the access token field
		access_token = aux_token;
		//If there's not a cookie yet, then set one for half a day
		//Note-to-self: How convenient is to have this for half a day? What's the ideal time?
		if(!getCookie("access_token"))
			setCookie("access_token",access_token,0.5); 
	}

	//Cleans the variables and layout for a new request
	cleanup();

	if(!access_token) { //If there's no access token send an error to the user and do nothing
		$('#statusbar').html("Error: Please provide an access token.");
	}
	else { //There's an access token

		//Calls up a general data request to the API for each programme
		reqdata(names.iGV.type,names.iGV.programme,"iGV");
		reqdata(names.iGT.type,names.iGT.programme,"iGT");
		reqdata(names.iGE.type,names.iGE.programme,"iGE");

		reqdata(names.oGV.type,names.oGV.programme,"oGV");
		reqdata(names.oGT.type,names.oGT.programme,"oGT");
		reqdata(names.oGE.type,names.oGE.programme,"oGE");


		//Request the list of entities
		reqeys(req_entity);

		$('#statusbar').html("Loading data...");
	}

}

function reqeys(ey){
	if(ey==-1) {
		req_entity = ey;
		console.log("Empty request")
	}
	else {
		var url = "https://gis-api.aiesec.org/v1/offices/"+req_entity+".json"; //Using version 1
		generalreq(url,{"access_token" : access_token},function (data){
			populateLCs(data);
			if($('#statusbar').html() == "Loading data...") {
				$('#statusbar').html("");
			}
			if(!error) {
				$('#statusbar').html("Loading... ("+getPercentage()+"%)");
			}
			console.log("Retrieved LC names");
			showResults(eys_array);
		});
	}
}

function reqdata(type,programme,name){
	var url = "https://gis-api.aiesec.org/v2/applications/analyze.json";
	var params = {
		"access_token" : access_token,
		"start_date" : req_start_date,
		"end_date" : req_end_date,
		"basic[home_office_id]" : req_entity,
		"basic[type]" : type,
		"programmes[]" : programme,
	}
	console.log(params);
	generalreq(url,params,function (data){
		populate(data,name);
		if($('#statusbar').html() == "Loading data...") {
			$('#statusbar').html("");
		}
		$('#statusbar').html("Loading... ("+getPercentage()+"%)");
		console.log("Retrieved "+name);
		showResults(eys_array);
	});
}

function getPercentage(){
	var tot = 0,loaded = 0;
	for (var prop in retrieved) {
		if(retrieved[prop] == 1)
			loaded++;
		tot++;
	}
	return Math.round(loaded/tot*100);
}

function populate(data,programme){
	//Check format analytics.children.buckets (Array)
	//key,doc_count, total_an_accepted (unique_profiles),total_applications (applicants),total_approvals,total_completed,total_matched,total_realized
	//total_x => doc_count
	try {
		var arr = data.analytics.children.buckets;
		for (var i = arr.length - 1; i >= 0; i--) {
			if(eys_array[arr[i].key] == undefined)
				eys_array[arr[i].key] = {};
			eys_array[arr[i].key][programme+"_ap"] = arr[i].total_approvals.doc_count;
			eys_array[arr[i].key][programme+"_re"] = arr[i].total_realized.doc_count;
		}
		retrieved[programme] += 1;
	}
	catch(err){
		$('#statusbar').html("Hubo un error interno! :S");
	}
}

function populateLCs(data){
	try {
		var arr = data.suboffices;
		for (var i = arr.length - 1; i >= 0; i--) {
			if(eys_array[arr[i].id] == undefined)
				eys_array[arr[i].id] = {};
			eys_array[arr[i].id].name = arr[i].name;
		}
		retrieved.name += 1;
	}
	catch(err){
		$('#statusbar').html("Hubo un error interno! :S");
	}
}

function showResults(a){
	if(retrieved.iGT == 1 && retrieved.oGT == 1 &&
		retrieved.iGV == 1 && retrieved.oGV == 1 &&
		retrieved.iGE == 1 && retrieved.oGE == 1 &&
		retrieved.name == 1) {
		for (var i = a.length - 1; i >= 0; i--) {
			if(a[i]!=undefined && i!=req_entity) {
				var tres = document.getElementById("results").tBodies.item(0);
				var newrow = tres.insertRow(-1);
				var col;
				col = newrow.insertCell(-1);
				col.innerHTML=a[i].name;
				col = newrow.insertCell(-1);
				col.innerHTML=a[i].iGV_ap||0;
				col = newrow.insertCell(-1);
				col.innerHTML=a[i].iGT_ap||0;
				col = newrow.insertCell(-1);
				col.innerHTML=a[i].iGE_ap||0;
				col = newrow.insertCell(-1);
				col.innerHTML=a[i].oGV_ap||0;
				col = newrow.insertCell(-1);
				col.innerHTML=a[i].oGT_ap||0;
				col = newrow.insertCell(-1);
				col.innerHTML=a[i].oGE_ap||0;
				col = newrow.insertCell(-1);
				col.innerHTML=(a[i].iGT_ap||0)+(a[i].oGT_ap||0)+(a[i].iGV_ap||0)+(a[i].oGV_ap||0)+(a[i].iGE_ap||0)+(a[i].oGE_ap||0);

				col = newrow.insertCell(-1);
				col.innerHTML=a[i].iGV_re||0;
				col = newrow.insertCell(-1);
				col.innerHTML=a[i].iGT_re||0;
				col = newrow.insertCell(-1);
				col.innerHTML=a[i].iGE_re||0;
				col = newrow.insertCell(-1);
				col.innerHTML=a[i].oGV_re||0;
				col = newrow.insertCell(-1);
				col.innerHTML=a[i].oGT_re||0;
				col = newrow.insertCell(-1);
				col.innerHTML=a[i].oGE_re||0;
				col = newrow.insertCell(-1);
				col.innerHTML=(a[i].iGT_re||0)+(a[i].oGT_re||0)+(a[i].iGV_re||0)+(a[i].oGV_re||0)+(a[i].iGE_re||0)+(a[i].oGE_re||0);
			}
		}
		$('#statusbar').html("");
		var exampleTable = document.querySelector('table#results')
		Sortable.init();
	}
}

/* 
 * setCookie
 *  
 * Description:
 * Auto-fills the start date and end date fields of the user view with the most used date ranges
 * 
 * @params: {string} cname - the name of the cookie
 * @params: {string} cvalue - the value of the cookie
 * @params: {string} cdays - the number of days in which the cookie will expire
 */

function setCookie(cname, cvalue, exdays) {
	//Note: Retrieved from W3CSchool. This can only hold 1 cookie, right?
    var d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    var expires = "expires="+d.toUTCString();
    document.cookie = cname + "=" + cvalue + "; " + expires;
}

function getCookie(cname) {
    var name = cname + "=";
    var ca = document.cookie.split(';');
    for(var i=0; i<ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1);
        if (c.indexOf(name) == 0) return c.substring(name.length, c.length);
    }
    return null;
}

/* 
 * presetDate
 *  
 * Description:
 * Auto-fills the start date and end date fields of the user view with the most used date ranges
 * 
 * @params: {string} value - A string representing a pre-settable Date
 *                         Currently supporting:
 *                           - This week so far
 *                           - This month so far
 *                           - This year so far
 *                           - This MC term so far
 *                           - Last week
 *                           - Last month
 *                         Coming soon (to be defined):
 *                           - This Q so far
 *                           - Last MC term
 */

function presetDate(value){
	var currdate = new Date(); //Get current Datetime (local time, not UTC)
	var start,end;

	switch(value){
		case "thisweek": //Note: Week starts on monday for the purposes of the program
			//Calculate how many days of the week have passed since monday
			var days = currdate.getDay()-1;
			if(days==-1) //If getDay is Sunday [0] (i.e. days==-1)
				days=6; //Then 6 days have passed since monday

			//Start date is Monday of that week
			//(i.e. substract to current day the number of days since monday)
			start = new Date(currdate);
			start.setDate(start.getDate()-days);

			document.getElementById("fini").value = formatDate(start);
			document.getElementById("ffin").value = formatDate(currdate); //End date is current date
			break;
		case "lastweek":
			//Calculate how many days of the week have passed since monday
			var days = currdate.getDay()-1;
			if(days==-1) //If getDay is Sunday [0] (i.e. days==-1)
				days=6; //Then 6 days have passed since monday

			//Start date is Monday of LAST week (Hence the minus 7)
			start = new Date(currdate);
			start.setDate(start.getDate()-days-7);

			//End date is Sunday of last week (Start date plus 6 days)
			end = new Date(start);
			end.setDate(end.getDate()+6);

			document.getElementById("fini").value = formatDate(start);
			document.getElementById("ffin").value = formatDate(end);
			break;
		case "thisyear":
			//Start date is January the 1st of this year (we change month and date)
			start = new Date(currdate); //This year info (oversimplified)
			start.setDate(1); //1st of
			start.setMonth(0); //January

			document.getElementById("fini").value = formatDate(start);
			document.getElementById("ffin").value = formatDate(currdate); //End date is current date
			break;
		case "thismc":
			//Start date is the July 1st that's closer in the past (either this year or last year,
			//depending on whether request is made after/during July this year or before that)
			
			//Set start Date to be July the 1st of this year
			start = new Date(currdate); //This year info (oversimplified)
			start.setDate(1); //1st of
			start.setMonth(6); //July
			//If July the 1st hasn't happened yet
			if(start > currdate)
				start.setFullYear(start.getFullYear()-1); //Then set it to last year's

			document.getElementById("fini").value = formatDate(start);
			document.getElementById("ffin").value = formatDate(currdate);
			break;
		case "thismonth":
			start = new Date(currdate); //This month and year info (oversimplified)
			start.setDate(1); //1st day of the month

			document.getElementById("fini").value = formatDate(start);
			document.getElementById("ffin").value = formatDate(currdate); //End date is current date
			break;	
		case "lastmonth":
			//TO-DO: Verify whether this works on January (it should, given that the bit down below does)
			
			//Set the start date to be the 1st day of last month
			start = new Date(currdate);
			start.setDate(1);
			start.setMonth(start.getMonth()-1);

			//This next use of the setDate method, I find very cool. Setting the date of the currdate
			//object to be zero causes the date to be set to "one day before the first day of the month",
			//which in turn leads to the date being the last day of the previous month. B)
			end = new Date(currdate);
			end.setDate(0); //Sets the date to the last day of the previous month

			document.getElementById("fini").value = formatDate(start);
			document.getElementById("ffin").value = formatDate(end);
			break;
	}

	function formatDate(d){
		return d.getFullYear()+"-"+(d.getMonth()<9?"0":"")+(d.getMonth()+1)+"-"+(d.getDate()<10?"0":"")+d.getDate();
	}
}