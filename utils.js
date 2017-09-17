module.exports = {
	/**
 	* Converts unix time stamp to local date format
 	*/
	timeConverter : function(unixTimeStamp){
		var options = { timeZone: "Europe/Kiev",
								hour12  :false};
		return new Date(unixTimeStamp*1000).toLocaleTimeString("en-US", options);
	},
	
	round: function(val, exp){
		var div =Math.pow(10, exp);
		var rounded =Math.floor(val*div)/div;
		
		return rounded;
	},

	average: function(array){
		let sum = array.reduce((x,y) => x+y);
		return sum/array.length; //average
	},
	
	generateStartDate: function (period, numOfPeriods){
	
	var currentTime =Date.now()/1000;
	
	var startDate = period*60 - currentTime % (period*60) + currentTime;
	
	return startDate - (numOfPeriods+1)*period*60;

	},
	
};