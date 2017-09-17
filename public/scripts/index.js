var socket = io();
			/**
			 * init on page load
			 */
           setInterval(function(){
           	if(socket.connected){
           		document.getElementById("serverStatus").textContent="Connected";
           		document.getElementById("serverStatus").style.color = "green";
           	}else{
           		document.getElementById("serverStatus").textContent="Not connected";
           		document.getElementById("serverStatus").style.color = "red";
           	}
           }, 3000);
          