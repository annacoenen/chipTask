// Set up initial global variables
var data1 = [nodeNames1[0], nodeNames1[1], nodeNames1[2],nodeNames1[3],'noNode'], // four nodes
    data2 = [nodeNames2[0], nodeNames2[1], nodeNames2[2],'noNode','noNode'], // three nodes
    currentblock = 1,
    paidTrials = 10,
    noNonPaidTrials = 2, // how many trials without bonus (for training in beginning)
    fixedPayment = 2,
    maxPayment = 1,
    testCost = 0.1,
    payoffs = [],
    colors = ["#993333","#339999"], // must match colors in likelihoods.js
    nodeNames = nodeNames1,
    states = states1, // start with four-node states
    fournodeGraphs = 2, // initial no. of four-node graphs in likelihoods.js
    condition = ''; 


// Initalize psiturk object
var psiTurk = new PsiTurk(uniqueId, adServerLoc, mode);

var pages = [
    "paymentPage.html",
    "thanks.html",
    "trainingEnd.html",
    "task.html"
];


var images = [
    "static/images/mainboard.svg"
];

psiTurk.preloadPages(pages);
psiTurk.preloadImages(images);

// Loading images can take a while, so show this before.
$(window).ready( function(){
    $('body').html('<p>Please wait while content is being loaded...');
});

// turn 'states' sub-array into strings so index for current state can be retrieved (haven't found a better solution yet)	
for (s = 0;s<=states1.length-1;s++) {
    states1[s] = JSON.stringify(states1[s]);
};
for (s = 0;s<=states2.length-1;s++) {
    states2[s] = JSON.stringify(states2[s]);
};

// noBlocks is number of three node comarisons plus training trials (not eligible for bonus)
var noBlocks = allcomparisons.length + noNonPaidTrials;

/*************************
* Some General Functions *
**************************/
//  Sort some array in the order of a given index
function sortBy(thisarray,index) {
    var newarray = [];
    for (i = 0; i<=index.length-1;i++) {
        newarray.push(thisarray[index[i]])
    }
    return newarray;
}


function randOrd(){
    return (Math.round(Math.random())-0.5);
}


function draw_arrow(thissvg,x1,y1,x2,y2){
    var adjustEdgeLength = function(numbers, scale) {
        var i = 0,
            max = numbers.length,
            scaled = [];
                                                
        for (i; i < max; i += 1) {
            scaled.push(numbers[i]*scale);
        }
                                                
        return scaled;
    };
    var offset1 = 120, // length to subtract from end of arrow: approximate radius of circles plus length of arrowhead
        offset2 = 51, // length to subtract from start of arrow: approximate radius of circles
        distance = Math.sqrt(Math.pow(x2-x1,2) + Math.pow(y2-y1,2)), // Distance between circle centers
        edgeCoordinates = [x2 - x1, y2 - y1],
        scale1 = offset1/distance, // Adjust scale
        scale2 = offset2/distance, // Adjust scale
        edgeAdjusted1 = adjustEdgeLength(edgeCoordinates, scale1),
        edgeAdjusted2 = adjustEdgeLength(edgeCoordinates, scale2),
        // Only adjust tip of the arrow for current purposes
        x2 = x2 - edgeAdjusted1[0],
        y2 = y2 - edgeAdjusted1[1],
        x1 = x1 + edgeAdjusted2[0],
        y1 = y1 + edgeAdjusted2[1];

    thissvg.append("svg:defs").append("svg:marker")
        .attr("id","Triangle")
        .attr("viewBox", "0 -5 10 10")   
        .attr("refX","0")
        .attr("refY","0")
        .style("fill", "#333399")
        .attr("markerWidth","5px")
        .attr("markerHeight","7px")
        .attr("orient","auto")
        .append("svg:path")
        .attr("d","M0,-5L10,0L0,5");        
    thissvg.append("svg:line")
        .attr("x1", x1)
        .attr("y1", y1)
        .attr("x2", x2)
        .attr("y2", y2)
        .attr("marker-end","url(#Triangle)")
        .style("stroke", "#333399")
        .style("stroke-width",15);
}



function colorToHex(color) {
    if (color.substr(0, 1) === '#') {
        return color;
    }
    var digits = /(.*?)rgb\((\d+), (\d+), (\d+)\)/.exec(color);
    
    var red = parseInt(digits[2]);
    var green = parseInt(digits[3]);
    var blue = parseInt(digits[4]);
    
    var rgb = blue | (green << 8) | (red << 16);
    return digits[1] + '#' + rgb.toString(16);
};



/************************
****  CIRCUIT BOARD ****
************************/

var CircuitBoard = function( canvas, filename, graph ) {
    // Initialize
    var that = this;


    // Load board and returns callback
    this.onLoad = function (callback) {
    // append svg file from filename to canvas div
        d3.xml(filename, "image/svg+xml", function( xml ) {
            var node = document.importNode(xml.documentElement, true);
            $(canvas).append(node); 

            // Initialize ciruit board variables
            that.board = d3.selectAll(canvas).select("svg");
            that.statusbar = that.board.selectAll("#status");
            callback();
        });
    }


    // Resize the board svg
    this.resize = function(width,height) {
        that.board
            .attr("width",width)
            .attr("height",height);
    }

    // Hide statusbar 
    this.boardOnly = function(){
        // console.log('board only')
        that.board.select("#statusbar")
            .style("display","none");
        that.board.selectAll(".visible")
            .style("fill","none")
    }


    // Draw nodes on the svg. Group of nodes must have '#node' ID
    // 'CircleOrder' contains ordered array of nodenames ("node1":N, or "noNode")
    this.drawCircles = function( circleOrder ) {
        // console.log("drawing circles");
        that.board.select("#nodes")
            .selectAll("circle") // Change to datatype of node if necessary (e.g. 'rect' or 'path')
            .data(circleOrder)
            .attr("class", function(d,i){
                if (d != 'noNode') {
                    return "visible";
                } else {
                    return "hidden";
                };         
            });
        // draws the visible circles
        that.board.selectAll(".visible")
            .style("fill", colors[0])
            .attr("id",function(d){ return d; });

        that.board.selectAll(".hidden")
            .style("stroke", "none");
        // Note: I was going to move this into the initialization part, BUT weirdly that caused the whole svg to be inserted way too far right on the page. No idea why!
        that.strokecolor = that.board.select("#nodes").select("#N1").style("stroke");
    }

    // Turn on clicked node and start intervention result
    this.enableClicking = function( doAfterInt ) {
        that.board.selectAll(".visible").on("click",function(d,i) {
            var that2 = this;
            that.doIntervention(that2,colors[1],doAfterInt); 
        })
    }

    // Intervention when overlap has been found
    this.doIntervention = function(that2, intervention, callback ){
         // Disable Clicking
        that.board.selectAll(".visible")
            .on("click",function(){});

         //  Get ID of node that was intervened on 
        var changedNode = d3.select(that2).data();
        // get current state of graph (before intervention)
        var currentState = [];
        var positions = []
        that.board.selectAll(".visible").each(function(d, i){
            ind = nodeNames.indexOf(d);
            currentState[ind] = colorToHex(d3.select(this).style('fill'));
            
            if (d == changedNode) {
                positions[ind] = [-500, -500];  // put these dots WAY off the canvas.  could be a problem
            } else {
                // get the x, y coordinate
                positions[ind] = [parseInt(d3.select(this).attr("cx")), parseInt(d3.select(this).attr("cy"))];
            }
        });


        // Change color of intervened node straight away
        d3.select(that2).style("fill", intervention);

        // Indicate intervention with black outline
        that.board.selectAll(".visible").style("stroke", that.strokecolor); // delete previous
        d3.select(that2).style("stroke", "black");

         // Get new state probabilities based on current state: 
        var indCurrentState = $.inArray(JSON.stringify(currentState),states);
        var probNewGraphs = likelihoods[graph][changedNode][intervention][indCurrentState];

         // Draw new state according to probabilities
        var rand = Math.random();
        var newState = [];
        for (ind=0;ind<=(probNewGraphs.length-1);ind++){
            var lowerProb = 0;
            var higherProb = 0;
            for (p =0;p<=(probNewGraphs.length-1);p++){
                if(p<ind)
                {
                    lowerProb = lowerProb + probNewGraphs[p];
                }
                if(p>ind)
                {
                    higherProb = higherProb + probNewGraphs[p];
                }
            }
            if ((rand <= (1-higherProb)) && (rand>=lowerProb))
            {
                var newState = JSON.parse(states[ind]); 
            }
        } 

        // turn all others black
        that.board.selectAll(".visible")
            .style("fill", "white");
        d3.select(that2).style("fill", intervention);

        setTimeout( 
            function(){  // delay before updating states
                that.board.selectAll(".visible").each(function(d, i){
                    ind = nodeNames.indexOf(d);
                    d3.select(this).style('fill',newState[ind])
                });

                // Make important variables available for saving, etc.
                that.intervention = intervention;
                that.changedNode = changedNode;
                that.newState = newState;
                callback && callback(); // Call back that intervention is over!
         },500);

        // add circles for state update animation
        var rings = that.board.selectAll("rings")
            .data(positions);

        rings.enter().append("circle")
            .attr("cx", function(d) { return d[0]; })
            .attr("cy", function(d) { return d[1]; })
            .attr("r", 20)
            .attr("class","rings")
            .style("fill", "none")
            .style("stroke", "#f4f4f4")
            .style("stroke-width", 10)
            .style("opacity","1.0");


        rings.transition()
            .duration(500)
            .ease("in")
            .attr("r","91")
            .style("opacity","0.0");
    }

    // Sets status in accordance with current trial
    this.setStatus = function(currenttrial) {
        if (currenttrial == 1)
        {
            this.statusheight = that.statusbar.attr("height");
            this.statusy = that.statusbar.attr("y");
        }
        else { 
            that.statusbar
                .attr("height", function(){
                    return ((trials-(currenttrial-1))*that.statusheight/trials+"px")
                })
                .attr("y",function(){
                    return (parseInt(that.statusy) + (currenttrial-1)*that.statusheight/trials)
                });
        }
    }


    // Draw Circuit diagram of this graph (arrows for connected nodes)
    this.drawDiagram = function() {
        var connections = parents[graphs.indexOf(graph)];
        that.board.selectAll(".visible").each(function(d,i){
            var child = d;
            var parentNodes = connections[child];
            var childx =  parseInt((d3.select(this).attr("cx")));
            var childy = parseInt((d3.select(this).attr("cy"))); 
            that.board.selectAll(".visible").each( function(d,i) {
                var parent = d;
                if(parentNodes.indexOf(parent)>-1)
                {
                    var parentx = parseInt((d3.select(this).attr("cx")));
                    var parenty = parseInt((d3.select(this).attr("cy")));
                    var parentr = parseInt((d3.select(this).attr("cr")));                      
                    draw_arrow(that.board,parentx,parenty,childx,childy);
                }
             });
        });
    }

    // Resets Board to null state
    this.reset = function() {
        that.board.selectAll(".visible").style("fill",colors[0]);
        that.board.selectAll(".visible").style("stroke",that.strokecolor);
    }

};


/**********************
* CODE FOR HYPOTHESES *
***********************/

var Hypotheses = function ( container, filename, currenthypotheses, graph, nodeOrder,callback ) {
    // Initialize Variables
    var that = this;
    // Draw Divs
    $(container).append('<div id="cellcontainer"></div>');
    $('#cellcontainer').append('<div id="hypotheses"></div>');
    $("#hypotheses").hide();


    // Add each hypothesis
    for(h=0;h<currenthypotheses.length;h++) {
        // Get hypothesis
        var hypothesis = currenthypotheses[h];

        // Force hypothesis to stay at current value (i.e. current iteration of the loop) for the following
        (function(hypothesis) {
            // Get the name to be displayed
            var name = "Chip Type "+(h+1);
            // Add wraper for this hypothesis
            $('#hypotheses').append('<span id = '+hypothesis+'wrap '+'class="hypwrap"></span>');
            // And add header
            $('#'+hypothesis+'wrap').append('<div class = "hypheader"></div>');
            // And append hypothesis
            var thisHypothesis = new CircuitBoard( '#'+hypothesis+'wrap', filename,hypothesis);


            // When board has loaded , do the following
            thisHypothesis.onLoad(function () {
                thisHypothesis.board.attr("id",hypothesis);
                // Add name to header
                $('#'+hypothesis+'wrap'+' .hypheader').append(name);
                thisHypothesis.resize( "200px","160px" );
                

                thisHypothesis.board.select("#Layer_2").style("opacity","0.5");
                // Draw circles
                thisHypothesis.drawCircles( nodeOrder ); 
                // Do not show statusbar, and grey out circles
                thisHypothesis.boardOnly();
                // Draw circuit diagram
                thisHypothesis.drawDiagram()
                // Call back 
                callback && callback();
            })
        })(hypothesis);

        // Transition to smaller hypotheses
        this.shrink = function() {
            var allBoards = d3.select('#hypotheses').selectAll("svg")
            allBoards.transition()
                .duration(1000)
                // .attr("width", 100)
                .attr("height", "90px")
                .style("margin-left","-20px")
                .style("margin-right","-20px")
                .style("margin-bottom","-20px")
                .select("#Layer_2").style("opacity","0");
    
            allBoards.selectAll(".visible").transition()
                .duration(1000)
                .style('stroke',"black")
                .style("fill","none");
        }

        // Transition back to new Hypotheses, adding on click
        this.grow = function() {
            var allBoards = d3.select('#hypotheses').selectAll("svg")
            allBoards.transition()
                .duration(500)
                .attr("width", "200px")
                .attr("height","160px")
                .style("margin","0 0 0 0")
                .select("#Layer_2").style("opacity","0.5");
            allBoards.selectAll(".visible").transition()
                .duration(500)
                .style('stroke',"#7A7B7B"); 
        }
    }        
}



/************************
*** INTERACTIVE BOARD ***
*************************/

var MainBoard = function ( container, filename, graph, currenthypotheses,nodeOrder,trials) {
    // Draw Divs
    $(container).append('<div id="canvas"></div>');

    // Initialize Variables
    var that = this,
        currentBoard = new CircuitBoard( '#canvas', filename,graph ),
        timestamp = new Date().getTime(),
        timebeforeNew = ''; 


    this.recordTrial = function(){
        var rt = (new Date().getTime()) - timestamp;
        if (nodeNames.length < 4) {
            newNodeState = currentBoard.newState
            newNodeState.push('none')
        }
        else {
            newNodeState = currentBoard.newState
        }

        var trialvals = [uniqueId,phase,currenthypotheses,graph,currentblock, currenttrial,newNodeState,currentBoard.intervention,currentBoard.changedNode,rt,timebeforeNew];
        psiTurk.recordTrialData(trialvals);
        psiTurk.saveData();

    }


    // When board has loaded , do the following
    currentBoard.onLoad(function(){
            // Resize circuitboard 
            currentBoard.resize( "440px","370px" );
            // Draw circles
            currentBoard.drawCircles( nodeOrder );
            // Show maximum Payment on CircuitBoard
            $("#canvas #statusmax").text('$'+maxPayment);
            // Go through trials
            var runTrials = function( ) {
                currentBoard.enableClicking(function(){
                    currenttrial++;
                    if (currenttrial <= trials)
                    {
                        currentBoard.setStatus(currenttrial);
                    }
                    if ((currenttrial == 1 && phase == 'task') | (currenttrial == trials) )
                    {   
                        console.log('showing button')
                        $('input[type="button"][name="continue"]').show()
                    }
                    
                    that.recordTrial();
                    timestamp = new Date().getTime();// Starting timestamp for next trial, and beginning of waiting time before changing/resetting board
   
                
                 
                    $('#secondbutton').show();
                    $('.login-form .footer').append('<input type="button" name="reset" value="Reset" class="button" id="secondbutton"/>').unbind().click(function() {
                        $('#secondbutton').remove();
                        timebeforeNew = (new Date().getTime())-timestamp; // Get time after trial end and resetting
                        timestamp = new Date().getTime();// Starting timestamp for next trial                        
                        currentBoard.reset();
                        runTrials();
                    })
                

                    console.log('intervention over, run this again!')
                    
                })
            } 
            // Start running trials
            runTrials();  
        })
}


/****************
* CODE FOR TASK *
*****************/

var FullTask = function ( container ) {
    // Initialize Variables//
    var that = this;

    phase = 'task' ;
    nBonustrials = paidTrials; // in how many trials is bonus bar reduced?
    currenttrial = 0;

    // Show task page 
    psiTurk.showPage("task.html");

    //  Choose stimuli
    var currenthypotheses = allcomparisons[currentblock-1]
    // Randomize order of graphs (randomize which one is correct underlying graph)
    currenthypotheses = _.shuffle(currenthypotheses);
    var graph = currenthypotheses[0]
    var alternative = currenthypotheses[1];

    // Randomize order of hypotheses for presentation
    currenthypotheses = _.shuffle(currenthypotheses)

    
    // Slider
    this.drawSlider = function() {
        $("#canvas").append('<p id = "slidertext" class = "slider">How confident are you about your decision?<br><br></p>'); // Append slider text 
        $("#canvas").append('<div id = "slidercontainer" class = "slider" </div>'); // Append slider container
        $("#slidercontainer").append('<span id = "sliderlabelleft" class = "slider">Not at all confident</span>'); // Append slider label
        $("#slidercontainer").append('<span id = "sliderlabelright" class = "slider">Very confident</span>'); // Append slider label
        $("#canvas").append('<div id = "slider" class = "slider"></div>'); // Append slider div
        $("#slider" ).slider(); // Append slider
        $("#slider a").css("left","50%") // Adjust position
    }

    // Block recording function
    this.recordBlock = function(selectedHyp, confidence) {
        var timestamp = new Date().getTime();
        var fromstart = timestamp - begintime;
        var blockvals = [uniqueId,"blockend",currenthypotheses,graph,currentblock,nodeOrder,confidence,selectedHyp,fromstart];
        psiTurk.recordTrialData( blockvals );
        psiTurk.saveData()
    }

    // Instructions during the task
    this.taskInstruct = function() {
        $('.col1').html('<p><b>Find out which chip diagram is correct by changing the components of the chip!</b></p>\
            <p>You have to set a component at least once, before proceeding.</p><p><i>Click \"Finished Testing\" once you think you have identified the chip.</i></p>')
    }

    // Instructions for testing
    this.selectionInstruct = function() {
        $('.col1').html('<p><b>Which chip diagram is correct?</b></p>\
            <p>Click on the diagram that you think best describes the chip that you tested.</p>')
    }


    // End of Block function (brings back hypotheses, shows slider, etc) 
    this.blockEnd = function(){
        that.drawSlider();
        that.selectionInstruct();
        d3.select("#canvas").selectAll("svg").remove(); // remove main board
        allHypotheses.grow(); // bring back hypotheses
        $("#mainbutton").hide(); // Hide button
        $("#mainbutton").attr("value","Next");

        // Enable clicking on hypotheses
        d3.selectAll("svg").on("click",function() {
            console.log("Hypothesis clicked")

            var selectedHyp =  d3.select(this).attr("id");

            // Red outline:
            d3.selectAll(".hypwrap")
                .style("border-width","0px");
            d3.select("#"+selectedHyp+"wrap")
                .style("border-width","3px")
                .style("border-color","red")
                .style("border-style","solid");
            
            
            // When hypothesis is selected, show slider and unbind any previous slidechange (when hypothesis is changed)
            $( "#slider" ).unbind("slidechange");
            $(".slider").show(); 

            $( "#slider" ).on( "slidechange", function( event, ui ) {
                // remove on click from hypotheses
                d3.select('#hypotheses').selectAll("svg").on("click",function(){});
                // remove slider event
                $( "#slider" ).unbind("slidechange");
                // Record confidencd
                var confidence = ui.value;

                // Calculate payment
                if (currenttrial-1<maxPayment/testCost && selectedHyp==graph) { 
                    var reward = maxPayment-(currenttrial-1)*testCost;
                }
                else { 
                    var reward = 0; 
                }

                payoffs.push(reward);
                

                // Feedback
                if ( selectedHyp==graph ) {
                    var feedback = '<p>Great job, you chose the correct diagram! ';
                }
                else {
                    var feedback = '<p><font color = "red">You chose the wrong chip diagram.</font> ';
                }

                // Payment info in training round
                if (currentblock<noNonPaidTrials) {
                    var payment = 'Outside of training, your potential bonus would be <b>$'+reward+'</b>.<br><br>';
                }
                // Payment info in real round
                else {
                    var payment = 'Your potential bonus from this section is <b>$'+reward+'</b>.<br><br>';
                }

                // Last training block test
                if ( currentblock == noNonPaidTrials) {
                    var trainingend = 'This was your <b>last training test</b>! All coming chip tests can be selected for your bonus.<br><br>';
                }
                else {
                    trainingend = '';
                }

                // End of experiment
                if ( currentblock == noBlocks ) {
                    $(feedback+payment+'You finished the last chip test.<br><br>Click \"Next\" to find out how much you will be paid for participating in this study.</p>').insertAfter('#canvas')                  
                    $("#mainbutton").show().unbind('click').click(function() { 
                        that.recordBlock( selectedHyp, confidence );
                        endTesting();
                    })
                }

                else if (currentblock == noNonPaidTrials) {
                    $(feedback+payment+trainingend+'Click \"Next\" to proceed to the next chip test.</p>').insertAfter('#canvas')                  
                    $("#mainbutton").show().unbind('click').click(function() {   
                        that.recordBlock( selectedHyp, confidence );
                        currentblock++;
                        trainingOver( container );
                    })                    
                }

                // Move on to next block
                else {
                    $(feedback+payment+trainingend+'Click \"Next\" to proceed to the next chip test.</p>').insertAfter('#canvas')                  
                    $("#mainbutton").show().unbind('click').click(function() {   
                        that.recordBlock( selectedHyp, confidence );
                        currentblock++;
                        FullTask( container );
                    })
                }
                
            });
        })
    }

     
     // Task Order //
    // Draw Hypotheses on screen (only show once all have been drawn), starting with four nodes

    if (graphs.indexOf(graph) > fournodeGraphs -1 ) {
        nodeNames = nodeNames2;
        states = states2
        nodeOrder = data2.sort(randOrd)
    }
    else {
        nodeNames = nodeNames1;
        states = states1
        nodeOrder = data1.sort(randOrd)
    }

    // Show chip diagrams
    var allHypotheses = new Hypotheses( container, 'static/images/mainboard.svg', currenthypotheses, graph, nodeOrder, function() {
        $("#hypotheses").show();
    } );  
    
    // On click, shrink hypotheses and display interactive board
    $("#mainbutton").unbind('click').click(function() {
        $("#mainbutton").hide();
        allHypotheses.shrink();
        setTimeout(function(){
            var interactiveBoard = new MainBoard(container, 'static/images/mainboard.svg', graph, currenthypotheses,nodeOrder,nBonustrials);
            that.taskInstruct();
            $("#mainbutton").hide().attr("value","Finished Testing").unbind('click').click(function() {
                $('#secondbutton').remove();
                that.blockEnd();
        });
        },1000);
    })

}




/***************************
* Finish up  & Data Saving *
****************************/

function trainingOver( container ) {
    psiTurk.showPage("trainingEnd.html");
    console.log('training over')
    randomSection = Math.ceil(Math.random()*payoffs.length);
    bonus = payoffs[randomSection-1];
    payment = bonus+fixedPayment;
    // $('body').html( traininend );

    $("#mainbutton").click(function () {
        payoffs = [];
        FullTask( container );
    })
}


prompt_resubmit = function() {
    replaceBody(error_message);
    $("#resubmit").click(resubmit);
};

function endTesting() {
    randomSection = Math.ceil(Math.random()*payoffs.length);
    bonus = payoffs[randomSection-1];
    payment = bonus+fixedPayment;
    psiTurk.recordTrialData(['bonus', bonus]);
    psiTurk.saveData();
    psiTurk.showPage( "paymentPage.html" )

    $("#mainbutton").click(function () {
        psiTurk.saveData({
            success: function(){
            psiTurk.completeHIT(); // when finished saving compute bonus, the quit

            }, 
            error: prompt_resubmit});
    });
}


// When content is loaded, start instructions
$(window).load( function(){
    console.log('starting everything');
    begintime = new Date().getTime();
    // Randomize Stims
    allcomparisons = _.shuffle(allcomparisons);
    // Add training comparisons at the beginning (two training blocks)
    allcomparisons.splice(0, 0, ['Diamond','DiamondReverse'],['DiamondReverse','Diamond']);
    // Start
    var task = FullTask('.col2');

});


       
       