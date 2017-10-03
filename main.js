(function() {
var canvas;
var ctx;
var mouse;The mouse position
var mouse_lastmousedown;//The last position of the mouse when the mouse is pressed
var objs = [];//The array containing the objects
var objCount = 0;//Number of objects
var isConstructing = false;//Is setting up a new object
var constructionPoint;//Starting position of the object
var draggingObj = -1;//Drag in the object number (-1 means no dragging,-3 for the whole picture,-4 observer)
var positioningObj = -1;//Enter the coordinates of the object number (-1 means no-4 observer)
var draggingPart = {};//Drag some mouse location information
var selectedObj = -1;//Select the object number (-1 means no selection)
var AddingObjType = '';//Drag the blank new object type
var waitingRays = [];//For processing light
var waitingRayCount = 0;//Number of pending light
var rayDensity_light = 0.1;//Light intensity (light mode)
var rayDensity_images = 1;//Density of light (mode)
var extendLight = false;//Viewer images
var showLight = true;//Display light
var gridSize = 20;//Grid size
var origin = {x: 0, y: 0};//Grid origin coordinates

var observer;
var mode = 'light';
var timerID = -1;
var isDrawing = false;
var hasExceededTime = false;
var forceStop = false;
var lastDrawTime = -1;
var stateOutdated = false; //The state has been changed after the last drawing
var minShotLength = 1e-6; //The shortest distance in which the light acts two times (light that is less than this distance will be ignored)
var minShotLength_squared = minShotLength * minShotLength;
var snapToDirection_lockLimit_squared = 900; //Drag the object and use the adsorption to the direction function, locking the direction of the desired drag distance of the square
var clickExtent_line = 10;
var clickExtent_point = 10;
var clickExtent_point_construct = 10;
var tools_normal = ['laser', 'radiant', 'parallel', 'blackline', 'ruler', 'protractor', ''];
var tools_withList = ['mirror_', 'refractor_'];
var tools_inList = ['mirror', 'arcmirror', 'idealmirror', 'lens', 'refractor', 'halfplane', 'circlelens'];
var modes = ['light', 'extended_light', 'images', 'observer'];
var xyBox_cancelContextMenu = false;

window.onload = function(e) {
  init_i18n();
  canvas = document.getElementById('canvas1');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx = canvas.getContext('2d');
  mouse = graphs.point(0, 0);
  
  if (typeof(Storage) !== "undefined" && localStorage.rayOpticsData) {
    document.getElementById('textarea1').value = localStorage.rayOpticsData;
  }
  
  if (document.getElementById('textarea1').value != ''){
    JSONInput();
    toolbtn_clicked('');
  }
  else{
    initParameters();
  }

  window.onmousedown = function(e){
    selectObj(-1);
  };

  canvas.onmousedown = function(e){
    document.getElementById('objAttr_text').blur();
    document.body.focus();
    canvas_onmousedown(e);
    e.cancelBubble = true;
    if (e.stopPropagation) e.stopPropagation();
    return false;
  };

  canvas.onmousemove = function(e){
    canvas_onmousemove(e);
  };

  canvas.onmouseup = function(e){
    canvas_onmouseup(e);
  };

  tools_normal.forEach(function(element, index){
    document.getElementById('tool_' + element).onmouseenter = function(e) {toolbtn_mouseentered(element, e);};
    document.getElementById('tool_' + element).onclick = function(e) {toolbtn_clicked(element, e);};
    cancelMousedownEvent('tool_' + element);
  });

  tools_withList.forEach(function(element, index){
    document.getElementById('tool_' + element).onmouseenter = function(e) {toolbtnwithlist_mouseentered(element, e);};
    document.getElementById('tool_' + element).onclick = function(e) {toolbtnwithlist_mouseentered(element, e);};
    document.getElementById('tool_' + element).onmouseleave = function(e) {toolbtnwithlist_mouseleft(element, e);};
    document.getElementById('tool_' + element + 'list').onmouseleave = function(e) {toollist_mouseleft(element, e);};
    cancelMousedownEvent('tool_' + element);
  });

  tools_inList.forEach(function(element, index){
    document.getElementById('tool_' + element).onclick = function(e) {toollistbtn_clicked(element, e);};
    cancelMousedownEvent('tool_' + element);
  });
  document.getElementById('reset').onclick = function() {initParameters();};
  cancelMousedownEvent('reset');
  modes.forEach(function(element, index){
  document.getElementById('mode_' + element).onclick = function() {
    modebtn_clicked(element);
  };
  cancelMousedownEvent('mode_' + element);
  });
  document.getElementById('rayDensity').oninput = function(){
    setRayDensity(Math.exp(this.value));
    draw();
  };
  document.getElementById('rayDensity').onmouseup = function(){
    setRayDensity(Math.exp(this.value)); 
    draw();
  };
  cancelMousedownEvent('rayDensity');
  cancelMousedownEvent('grid_');
  document.getElementById('showgrid_').onclick = function() {draw()};
  cancelMousedownEvent('showgrid_');

  document.getElementById('objAttr_range').oninput = function(){
    setAttr(document.getElementById('objAttr_range').value * 1);
  };

  document.getElementById('objAttr_range').onmouseup = function(){
    createUndoPoint();
  };
  cancelMousedownEvent('objAttr_range');
  document.getElementById('objAttr_text').onchange = function()
  {
    setAttr(document.getElementById('objAttr_text').value * 1);
  };

  document.getElementById('copy').onclick = function(){
    objs[objs.length] = JSON.parse(JSON.stringify(objs[selectedObj]));
    draw();
  };
  cancelMousedownEvent('copy');
  document.getElementById('delete').onclick = function(){
    removeObj(selectedObj);
    draw();
  };
  cancelMousedownEvent('delete');
  document.getElementById('textarea1').onchange = function(){
    JSONInput();
  };
  document.getElementById('save_cancel').onclick = function(){
    document.getElementById('saveBox').style.display = 'none';
  };
  document.getElementById('save_confirm').onclick = save;
  cancelMousedownEvent('saveBox');
  document.getElementById('xybox').oninput = function(e){
    this.size = this.value.length;
  };

  document.getElementById('xybox').addEventListener('contextmenu', function(e) {
    if (xyBox_cancelContextMenu){
       e.preventDefault();
       xyBox_cancelContextMenu = false;
    }
      }, false);
  cancelMousedownEvent('xybox');
    
}

function getMsg(msg) {
  return locales["en"][msg].message;
}
function init_i18n() {
    // just for the image purpose
    var downarraw = '\u25BC';
    document.title = getMsg('appName');
    //dataset['n'] referse to the name of the tool and the dataset['p'] refers to the property of the tool   
    //===========toolbar===========
    document.getElementById('toolbar_title').innerHTML = getMsg('toolbar_title');

    //Ray
    document.getElementById('tool_laser').value = getMsg('toolname_laser');
    document.getElementById('tool_laser').dataset['n'] = getMsg('toolname_laser');

    //Point source
    document.getElementById('tool_radiant').value = getMsg('toolname_radiant');
    document.getElementById('tool_radiant').dataset['n'] = getMsg('toolname_radiant');
    document.getElementById('tool_radiant').dataset['p'] = getMsg('brightness');

    //Beam
    document.getElementById('tool_parallel').value = getMsg('toolname_parallel');
    document.getElementById('tool_parallel').dataset['n'] = getMsg('toolname_parallel');
    document.getElementById('tool_parallel').dataset['p'] = getMsg('brightness');

    //Mirror▼
    document.getElementById('tool_mirror_').value = getMsg('toolname_mirror_') + downarraw;

    //Mirror->Line
    document.getElementById('tool_mirror').value = getMsg('tooltitle_mirror');
    document.getElementById('tool_mirror').dataset['n'] = getMsg('toolname_mirror_');

    //Mirror->Circular Arc
    document.getElementById('tool_arcmirror').value = getMsg('tooltitle_arcmirror');
    document.getElementById('tool_arcmirror').dataset['n'] = getMsg('toolname_mirror_');

    //Mirror->Curve (ideal)
    document.getElementById('tool_idealmirror').value = getMsg('tooltitle_idealmirror');
    document.getElementById('tool_idealmirror').dataset['n'] = getMsg('toolname_idealmirror');
    document.getElementById('tool_idealmirror').dataset['p'] = getMsg('focallength');

    //Refractor▼
    document.getElementById('tool_refractor_').value = getMsg('toolname_refractor_') + downarraw;

    //Refractor->Half-plane
    document.getElementById('tool_halfplane').value = getMsg('tooltitle_halfplane');
    document.getElementById('tool_halfplane').dataset['n'] = getMsg('toolname_refractor_');
    document.getElementById('tool_halfplane').dataset['p'] = getMsg('refractiveindex');

    //Refractor->Circle
    document.getElementById('tool_circlelens').value = getMsg('tooltitle_circlelens');
    document.getElementById('tool_circlelens').dataset['n'] = getMsg('toolname_refractor_');
    document.getElementById('tool_circlelens').dataset['p'] = getMsg('refractiveindex');

    //Refractor->Other shape
    document.getElementById('tool_refractor').value = getMsg('tooltitle_refractor');
    document.getElementById('tool_refractor').dataset['n'] = getMsg('toolname_refractor_');
    document.getElementById('tool_refractor').dataset['p'] = getMsg('refractiveindex');

    //Refractor->Lens (ideal)
    document.getElementById('tool_lens').value = getMsg('tooltitle_lens');
    document.getElementById('tool_lens').dataset['n'] = getMsg('toolname_lens');
    document.getElementById('tool_lens').dataset['p'] = getMsg('focallength');

    //Blocker
    document.getElementById('tool_blackline').value = getMsg('toolname_blackline');
    document.getElementById('tool_blackline').dataset['n'] = getMsg('toolname_blackline');

    //Ruler
    document.getElementById('tool_ruler').value = getMsg('toolname_ruler');
    document.getElementById('tool_ruler').dataset['n'] = getMsg('toolname_ruler');

    //Protractor
    document.getElementById('tool_protractor').value = getMsg('toolname_protractor');
    document.getElementById('tool_protractor').dataset['n'] = getMsg('toolname_protractor');

    //Move view
    document.getElementById('tool_').value = getMsg('toolname_');
    
    //===========modebar===========
    document.getElementById('modebar_title').innerHTML = getMsg('modebar_title');
    document.getElementById('mode_light').value = getMsg('modename_light');
    document.getElementById('mode_extended_light').value = getMsg('modename_extended_light');
    document.getElementById('mode_images').value = getMsg('modename_images');
    document.getElementById('mode_observer').value = getMsg('modename_observer');
    document.getElementById('rayDensity_title').innerHTML = getMsg('raydensity');

    document.getElementById('setAttrAll_title').innerHTML = getMsg('applytoall');
    document.getElementById('copy').value = getMsg('duplicate');
    document.getElementById('delete').value = getMsg('delete');

    document.getElementById('forceStop').innerHTML = getMsg('processing');
    
    document.getElementById('footer_message').innerHTML = getMsg('footer_message');
    document.getElementById('homepage').innerHTML = getMsg('homepage');
    document.getElementById('source').innerHTML = getMsg('source');
  }

function JSONInput(){
  var jsonData = JSON.parse(document.getElementById('textarea1').value);
  if (typeof jsonData != 'object')return;
  if (!jsonData.version){
    var str1 = document.getElementById('textarea1').value.replace(/"point"|"xxa"|"aH"/g, '1').replace(/"circle"|"xxf"/g, '5').replace(/"k"/g, '"objs"').replace(/"L"/g, '"p1"').replace(/"G"/g, '"p2"').replace(/"F"/g, '"p3"').replace(/"bA"/g, '"exist"').replace(/"aa"/g, '"parallel"').replace(/"ba"/g, '"mirror"').replace(/"bv"/g, '"lens"').replace(/"av"/g, '"notDone"').replace(/"bP"/g, '"lightAlpha"').replace(/"ab"|"observed_light"|"observed_images"/g, '"observer"');
    jsonData = JSON.parse(str1);
    if (!jsonData.objs){
      jsonData = {objs: jsonData};
    }
    if (!jsonData.mode){
      jsonData.mode = 'light';
    }
    if (!jsonData.rayDensity_light){
      jsonData.rayDensity_light = 1;
    }
    if (!jsonData.rayDensity_images){
      jsonData.rayDensity_images = 1;
    }
    jsonData.version = 1;
  }
  if (jsonData.version == 1){
    jsonData.origin = {x: 0, y: 0};
  }
  if (jsonData.version > 2){
    return;
  }
  objs = jsonData.objs;
  rayDensity_light = jsonData.rayDensity_light;
  rayDensity_images = jsonData.rayDensity_images;
  observer = jsonData.observer;
  origin = jsonData.origin;
  modebtn_clicked(jsonData.mode);
  selectObj(selectedObj);
}

function JSONOutput(){
  document.getElementById('textarea1').value = JSON.stringify({version: 2, objs: objs, mode: mode, rayDensity_light: rayDensity_light, rayDensity_images: rayDensity_images, observer: observer, origin: origin});
  if (typeof(Storage) !== "undefined") {
    localStorage.rayOpticsData = document.getElementById('textarea1').value;
  }
}

function selectObj(index){
  //If the chosen index is out of the range then select none and set the display of the properties section to none
  if (index < 0 || index >= objs.length){
    selectedObj = -1;
    document.getElementById('obj_settings').style.display = 'none';
    return;
  }
  selectedObj = index;
  document.getElementById('obj_name').innerHTML = document.getElementById('tool_' + objs[index].type).dataset['n']; // n for name
  if (objTypes[objs[index].type].p_name)// if the selected object has a property
  {
    document.getElementById('p_box').style.display = '';
    var p_temp = objs[index].p;
    document.getElementById('p_name').innerHTML = document.getElementById('tool_' + objs[index].type).dataset['p'];
    document.getElementById('objAttr_range').min = objTypes[objs[index].type].p_min;
    document.getElementById('objAttr_range').max = objTypes[objs[index].type].p_max;
    document.getElementById('objAttr_range').step = objTypes[objs[index].type].p_step;
    document.getElementById('objAttr_range').value = p_temp;
    document.getElementById('objAttr_text').value = p_temp;
    objs[index].p = p_temp;
  }
// if the object doesnt has property then dont display   
  else{
    document.getElementById('p_box').style.display = 'none';
  }
// display the object settings 
  document.getElementById('obj_settings').style.display = '';
}

function canvas_onmousedown(e) {
  var et=e;
  var mouse_nogrid = graphs.point(et.pageX - e.target.offsetLeft, et.pageY - e.target.offsetTop); //Actual mouse position
  mouse_lastmousedown = mouse_nogrid;
  if (positioningObj != -1){
    confirmPositioning(e.ctrlKey, e.shiftKey);
    if (!(e.which && e.which == 3)){      
      return;
    }
  }

  if (!((e.which && (e.which == 1 || e.which == 3))){
    return;
  }
  // if the grid is checked update the mouse position accordingly
  if (document.getElementById('grid').checked){
    mouse = graphs.point(Math.round((et.pageX - e.target.offsetLeft - origin.x) / gridSize) * gridSize + origin.x, Math.round((et.pageY - e.target.offsetTop - origin.y) / gridSize) * gridSize + origin.y);
  }
  else{
    mouse = mouse_nogrid;
  }

  if (isConstructing){
    if (e.which && e.which == 1){
      // pass the control to the respective function of the objTypes
      objTypes[objs[objs.length - 1].type].c_mousedown(objs[objs.length - 1], mouse);
    }
  }
  else{
    if ((!(document.getElementById('lockobjs').checked) != (e.altKey && AddingObjType != '')) && !(e.which == 3)){
      //Search for each object and find the object that the mouse is pressing
      draggingPart = {};
      if (mode == 'observer'){
        if (graphs.length_squared(mouse_nogrid, observer.c) < observer.r * observer.r){
          //Press the mouse to the observer
          draggingObj = -4;
          draggingPart = {};
          draggingPart.mouse0 = mouse; //The position of the mouse when you start dragging
          draggingPart.mouse1 = mouse; //The mouse position of the last point of the drag
          draggingPart.snapData = {};
          return;
        }
      }

      var draggingPart_ = {};
      var click_lensq = Infinity;
      var click_lensq_temp;
      var targetObj_index = -1;
      //var targetObj_index_temp;
      var targetIsPoint = false;

      //for(var i=objs.length-1;i>=0;i--)
      for (var i = 0; i < objs.length; i++){
        if (typeof objs[i] != 'undefined'){
            draggingPart_ = {};
            if (objTypes[objs[i].type].clicked(objs[i], mouse_nogrid, mouse, draggingPart_)){
              //clicked()回傳true表示滑鼠按到了該物件

              if (draggingPart_.targetPoint)
              {
                //滑鼠按到一個點
                targetIsPoint = true; //一旦發現能夠按到點,就必須按到點
                click_lensq_temp = graphs.length_squared(mouse_nogrid, draggingPart_.targetPoint);
                if (click_lensq_temp <= click_lensq)
                {
                  targetObj_index = i; //按到點的情況下,選擇最接近滑鼠的
                  click_lensq = click_lensq_temp;
                  draggingPart = draggingPart_;
                }
              }
              else if (!targetIsPoint)
              {
                //滑鼠按到的不是點,且到目前為止未按到點
                targetObj_index = i; //按到非點的情況下,選擇最後建立的
                draggingPart = draggingPart_;
              }

            }
          }
        }
        if (targetObj_index != -1)
        {
          //最後決定選擇targetObj_index
          selectObj(targetObj_index);
          draggingPart.originalObj = JSON.parse(JSON.stringify(objs[targetObj_index])); //暫存拖曳前的物件狀態
          draggingPart.hasDuplicated = false;
          draggingObj = targetObj_index;
          return;
        }
      }

    if (draggingObj == -1)
      {
      //====================滑鼠按到了空白處=============================
       if ((AddingObjType == '') || (e.which == 3))
       {
       //====================準備平移整個畫面===========================
         draggingObj = -3;
         draggingPart = {};
         //draggingPart.part=0;
         draggingPart.mouse0 = mouse; //開始拖曳時的滑鼠位置
         draggingPart.mouse1 = mouse; //拖曳時上一點的滑鼠位置
         draggingPart.snapData = {};
         document.getElementById('obj_settings').style.display = 'none';
         selectedObj = -1;
       }
       else
       {
       //=======================建立新的物件========================
        objs[objs.length] = objTypes[AddingObjType].create(mouse);
        isConstructing = true;
        constructionPoint = mouse;
        if (objs[selectedObj])
        {
          if (hasSameAttrType(objs[selectedObj], objs[objs.length - 1]))
          {
            objs[objs.length - 1].p = objs[selectedObj].p; //讓此物件的附加屬性與上一個選取的物件相同(若類型相同)
          }
        }
        selectObj(objs.length - 1);
        objTypes[objs[objs.length - 1].type].c_mousedown(objs[objs.length - 1], mouse);
       }
      }
  }
  }
  //================================================================================================================================
  //========================================================MouseMove===============================================================
  function canvas_onmousemove(e) {
  //滑鼠移動時
  var et=e;
  var mouse_nogrid = graphs.point(et.pageX - e.target.offsetLeft, et.pageY - e.target.offsetTop); // Calculating relative to cordinate system
  var mouse2;
  if (document.getElementById('grid').checked && isConstructing){
    // if grid is on
    mouse2 = graphs.point(Math.round((et.pageX - e.target.offsetLeft - origin.x) / gridSize) * gridSize + origin.x, Math.round((et.pageY - e.target.offsetTop - origin.y) / gridSize) * gridSize + origin.y);
  }
  else{   // if grid is off this is same as mouse_nogrid
    mouse2 = graphs.point(et.pageX - e.target.offsetLeft, et.pageY - e.target.offsetTop);
  }
  // if initial and final points are same do nothing
  if (mouse2.x == mouse.x && mouse2.y == mouse.y){
    return;
  }
  // update mouse to the new position
  mouse = mouse2;

  if (isConstructing){//If an object is being established, the action is passed directly to it
    objTypes[objs[objs.length - 1].type].c_mousemove(objs[objs.length - 1], mouse, e.ctrlKey, e.shiftKey);
  }
}
  //==================================================================================================================================
  //==============================MouseUp===============================
function canvas_onmouseup(e) {
if (isConstructing){
  if (e.which && e.which == 1){        // left mouse button is pressed 
    //If an object is being established, the action is passed directly to it
    objTypes[objs[objs.length - 1].type].c_mouseup(objs[objs.length - 1], mouse);
  }
}
}
/**
  * @brief event handler when a a mouse enters a tool button which doesnt has a list i.e. a normal tool buttton. it just hides all the lists 
  * @method toolbtn_mouseentered
  * @param {tool} tool 
  * @param {event} e 
  * @return {NULL}
  **/
function toolbtn_mouseentered(tool, e)
{
  hideAllLists();
}
/**
  * @brief event handler for the event when a tool is clicked.
  * @method toolbtn_clicked
  * @param {tool} tool 
  * @param {event} e 
  * @return {NULL}
  * @detail resets and updates the classnames of the Html elemensts to differentiate the current selected tool from rest the hides all the lists and sets the variable addingObjType to the 
  current object that is tool.
  **/
function toolbtn_clicked(tool, e)
{

  tools_normal.forEach(function(element, index)
  {
    document.getElementById('tool_' + element).className = 'toolbtn';
  });
  tools_withList.forEach(function(element, index)
  {
    document.getElementById('tool_' + element).className = 'toolbtn';
  });
  tools_inList.forEach(function(element, index)
  {
    document.getElementById('tool_' + element).className = 'toollistbtn';
  });

  hideAllLists();

  document.getElementById('tool_' + tool).className = 'toolbtnselected';
  AddingObjType = tool;
}
/**
  * @brief event handler when a a mouse enters a tool button which has list.  
  * @method toolbtnwithlist_mouseentered
  * @param {tool} tool 
  * @param {event} e 
  * @return {NULL}
  * @detail gets the bounding rectangle of the tool, updates the style elements of the tool on which mouse has entered so that the list gets displayed and updates the class of the
  tool from toolbtn to toolbtnwithlisthover
  **/
function toolbtnwithlist_mouseentered(tool, e)
{
  hideAllLists();
  var rect = document.getElementById('tool_' + tool).getBoundingClientRect();
  document.getElementById('tool_' + tool + 'list').style.left = rect.left + 'px';
  document.getElementById('tool_' + tool + 'list').style.top = rect.bottom + 'px';
  document.getElementById('tool_' + tool + 'list').style.display = '';
  if (document.getElementById('tool_' + tool).className == 'toolbtn')
  {
    document.getElementById('tool_' + tool).className = 'toolbtnwithlisthover';
  }
}
/**
  * @brief event handler when a a mouse leaves a tool button which has list, hides the list after verifying that the mouse has left a certain area around the list and resets the class of the element
  * @method toolbtnwithlist_mouseleft
  * @param {tool} tool 
  * @param {event} e 
  * @return {NULL}
  * @detail gets the bounding rectangle of the list checks , updates the mouse variable to store the value of the point at which mouse was on when the event was triggered and checks that the 
  mouse left a ceratin boundary of the area, if so closes the list and resets the class of the listtool to toolbtn
  **/
function toolbtnwithlist_mouseleft(tool, e)
{
  var rect = document.getElementById('tool_' + tool + 'list').getBoundingClientRect();
  mouse = graphs.point(e.pageX, e.pageY);
  if (mouse.x < rect.left || mouse.x > rect.right || mouse.y < rect.top - 5 || mouse.y > rect.bottom)
  {
    document.getElementById('tool_' + tool + 'list').style.display = 'none';
    if (document.getElementById('tool_' + tool).className == 'toolbtnwithlisthover')
    {
      document.getElementById('tool_' + tool).className = 'toolbtn';
    }
  }

}
/**
  * @brief event handler when a a mouse leaves a list, hides the list after verifying that the mouse has left a certain area around the list
  * @method toollist_mouseleft
  * @param {tool} tool 
  * @param {event} e 
  * @return {NULL}
  * @detail gets the bounding rectangle of the list checks , updates the mouse variable to store the value of the point at which mouse was on when the event was triggered and checks that the 
  mouse left a ceratin boundary of the area, if so closes the list and resets the class of the listtool to toolbtn
  **/
function toollist_mouseleft(tool, e)
{
  var rect = document.getElementById('tool_' + tool).getBoundingClientRect();
  mouse = graphs.point(e.pageX, e.pageY);
  if (mouse.x < rect.left || mouse.x > rect.right || mouse.y < rect.top || mouse.y > rect.bottom + 5)
  {
    document.getElementById('tool_' + tool + 'list').style.display = 'none';
    if (document.getElementById('tool_' + tool).className == 'toolbtnwithlisthover')
    {
      document.getElementById('tool_' + tool).className = 'toolbtn';
    }
  }
}
/**
  * @brief hides the list by setting the display attribut to none and resets the class of the toollist
  * @method hideAllLists
  * @param {NULL}  
  * @return {NULL}
  **/

function hideAllLists()
{
  tools_withList.forEach(function(element, index)
  {
    document.getElementById('tool_' + element + 'list').style.display = 'none';
    if (document.getElementById('tool_' + element).className == 'toolbtnwithlisthover')
    {
      document.getElementById('tool_' + element).className = 'toolbtn';
    }
  });
}
/**
  * @brief event handler when a tool whitin a list is clicked
  * @method toollistbtn_clicked
  * @param {tool} tool 
  * @param {event} e 
  * @return {NULL}
  * @detail resets and updates the classnames of the Html elemensts to differentiate the current selected tool from rest the hides all the lists and sets the variable addingObjType to the 
  current object that is tool
  **/
function toollistbtn_clicked(tool, e)
{
  var selected_toolbtn;// Press the toolbtn   previously
  var selecting_toolbtnwithlist; //This toollistbtn belongs to toolbtnwithlist
  tools_withList.forEach(function(element, index)
  {
    if (document.getElementById('tool_' + element).className == 'toolbtnwithlisthover')
    {
      selecting_toolbtnwithlist = element;
    }
    if (document.getElementById('tool_' + element).className == 'toolbtnselected')
    {
      selected_toolbtn = element;
    }
  });
  if (!selecting_toolbtnwithlist)
  {
    selecting_toolbtnwithlist = selected_toolbtn; //這個toollistbtn屬於先前被按下的toolbtn
  }
  //console.log(selecting_toolbtnwithlist);
  tools_normal.forEach(function(element, index)
  {
    document.getElementById('tool_' + element).className = 'toolbtn';
  });
  tools_withList.forEach(function(element, index)
  {
    document.getElementById('tool_' + element).className = 'toolbtn';
  });
  tools_inList.forEach(function(element, index)
  {
    document.getElementById('tool_' + element).className = 'toollistbtn';
  });

  hideAllLists();

  document.getElementById('tool_' + selecting_toolbtnwithlist).className = 'toolbtnselected';
  document.getElementById('tool_' + tool).className = 'toollistbtnselected';
  AddingObjType = tool;
}

/**
  * @brief handles the change of viewing mode done by user
  * @method modebtn_clicked
  * @param {new viweing mode} mode1 
  * @return {NULL}
  * @detail resets the status of previous selected modebtn to toolbtn and chabges the status of the newbtn to toonbtn_selected resets the mode variable to current mode
  * updates the ray density value according to the viewing mode and makes an observer if the new mode is observer and the onserver is not already there
  **/

function modebtn_clicked(mode1)
{
  document.getElementById('mode_' + mode).className = 'toolbtn';
  document.getElementById('mode_' + mode1).className = 'toolbtnselected';
  mode = mode1;
  if (mode == 'images' || mode == 'observer')
  {
    document.getElementById('rayDensity').value = Math.log(rayDensity_images);
  }
  else
  {
    document.getElementById('rayDensity').value = Math.log(rayDensity_light);
  }
  if (mode == 'observer' && !observer)
  {
    observer = graphs.circle(graphs.point(canvas.width * 0.5, canvas.height * 0.5), 20);
  }
  draw();
}

/**
  * Prevents the propagation of the event
  * @method cancelMousedownEvent
  * @param {id of an HTML element} id 
  * @return {NULL}
  * Prevents the propagation of the event
  **/
function cancelMousedownEvent(id)
{
  document.getElementById(id).onmousedown = function(e)
  {
    e.cancelBubble = true;
    if (e.stopPropagation) e.stopPropagation();
  };
  document.getElementById(id).ontouchstart = function(e)
  {
    e.cancelBubble = true;
    if (e.stopPropagation) e.stopPropagation();
  };
}

/**
  * set the ray density
  * @method setRayDensity
  * @param {Number} value 
  * @return {NULL}
  * Changes the density of rays according to the mode the user is using to view the object
  **/
function setRayDensity(value)
{
  if (mode == 'images' || mode == 'observer'){
    rayDensity_images = value;
  }
  else{
    rayDensity_light = value;
  }
}

/**
  * @brief initializes the essential parameters when the window is reloaded or the window is reset and draws a clean canvas
  * @method initParameters
  * @param {NULL} 
  * @return {NULL}
  **/
function initParameters(){
  isConstructing = false;
  endPositioning();
  objs.length = 0;
  selectObj(-1);

  rayDensity_light = 0.1; 
  rayDensity_images = 1; 
  extendLight = false; 
  showLight = true; 
  origin = {x: 0, y: 0};
  observer = null;
  
  toolbtn_clicked('');
  modebtn_clicked('light');

  document.getElementById('lockobjs').checked = false;
  document.getElementById('grid').checked = false;
  document.getElementById('showgrid').checked = false;

  document.getElementById('setAttrAll').checked = false;

  draw();
}

