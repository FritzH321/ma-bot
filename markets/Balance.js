

var fs = require('fs');
var keys = JSON.parse(fs.readFileSync(__dirname+'/keys.json', 'utf8'));

var POLO = require("./api/poloniex");
var polo = new POLO(keys["poloniex"]["key"], keys["poloniex"]["secret"]);



var console = process.console;
function Balance(){
	
	this.balanceMatrix = {
	};
}

Balance.prototype.updateBalance = function(callback){
	var self = this;
		console.log("Requesting balances");
		//requesting poloniex balance
		polo.returnBalances(function(err, data){
			console.log("Requesting balance at Poloniex");
			if(!err){
				self.balanceMatrix.polo = data;
				console.log(self.balanceMatrix);
				callback();
					
					
			}else{
			 console.log(err.toString());
			 }
		});
	
};

Balance.prototype.getBalance = function(pair, mode){
	
	var curr="";
	
		
	switch(mode){
		case "buy":
			curr =pair.split("_")[0];
		break;

		case "sell":
			curr =pair.split("_")[1];
		break;
		}
	return parseFloat(this.balanceMatrix.polo[curr]) || 0;
	
		
	
	
};
module.exports = Balance;