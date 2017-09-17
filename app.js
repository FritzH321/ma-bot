/*eslint-env node*/

//------------------------------------------------------------------------------
// node.js starter application for Bluemix
//------------------------------------------------------------------------------

var express = require("express");
var scribe = require("scribe-js")();
// cfenv provides access to your Cloud Foundry environment
// for more info, see: https://www.npmjs.com/package/cfenv
var cfenv = require("cfenv");

var path = require("path");

// create a new express server
var app = express();
 var http = require("http").Server(app);
 var io = module.exports = require("socket.io")(http);
var routes = require("./routes/index");
var Manager = require("./manager");
var manager = new Manager();
var console = process.console;
app.set("views", path.join(__dirname, "views"));
app.set("view engine","ejs");
app.use(express.static(__dirname + "/public"));
app.use("/", routes);
app.use("/logs", scribe.webPanel());
app.use(scribe.express.logger());

app.use(function(req, res, next){
	var err = new Error("Not found");
	err.status = 404;
	next(err);

});

app.use(function(err, req, res, next){
	res.status(err.status || 500);
	res.render("error", {
		message : err.message,
		error :{}
	});

});







// get the app environment from Cloud Foundry
var appEnv = cfenv.getAppEnv();

// start server on the specified port and binding host

http.listen(appEnv.port, function() {
	
  // print a message when the server starts listening
  console.log("server starting on " + appEnv.url);
  console.log("server running on " + appEnv.port);
});

manager.runBot();




