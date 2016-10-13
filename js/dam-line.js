import $ from 'jquery';
import PIXI from 'hdv/libs/pixi.min';
import _ from 'lodash';
import Wheel from 'wheel';
import * as d3 from 'hdv/libs/d3.min';

export default class Visual {
    constructor() {
      this.init = false;
    }

    renderGraph(data){
        if (!data || !data.length) { return }

        this.data = data;
        
        if (this.init) {
            this.nodeStage.removeChildren();
            this.edgeStage.removeChildren();
            this.renderer.render(this.nodeStage);
        } else {
            this.$container = $('.pixi-container');
            this.w = this.$container[0].offsetWidth;
            this.h =  $(window).height() - 100;
            this.renderer =  new PIXI.WebGLRenderer(this.w, this.h, { antialias: true, backgroundColor : 0xffffff });
            this.$container[0].appendChild(this.renderer.view);
            this.nodeStage = new PIXI.Container();
            this.edgeStage = new PIXI.Container();
            this.init = true;
        }

        this.prepData();
        this.startForce();

        let ctx = this;

        this.force.on("tick", function(){
            let p = (1 - ctx.force.alpha()) * 100;
            console.log( p + '%');
        });

        this.force.on("end", function(){
            console.log('ENDED');
            console.log('Nodes: ', ctx.nodeData.length,', Edges: ', ctx.edgeData.length);
            let renderedEdges = 0;
            ctx.edgeData.forEach(function(d, i){
                let e = ctx.createEdge(d, i);
                if (e) {
                    renderedEdges += 1;
                    ctx.edgeStage.addChild(e);
                }
            });
            
            ctx.force.nodes().forEach(function(d){
                ctx.nodeStage.addChild(ctx.createNode(d));
            });
            let bgRect = new PIXI.Graphics();
            bgRect.hitArea = new PIXI.Rectangle(ctx.w*-0.5,ctx.h*-0.5,ctx.w*2, ctx.h*2);
            ctx.nodeStage.addChildAt(bgRect.drawRect(0, 0, ctx.w, ctx.h), 0)
            ctx.nodeStage.addChildAt(ctx.edgeStage, 1);
            ctx.renderer.render(ctx.nodeStage);
            ctx.addDragNDrop()
            ctx.addZoom();

            requestAnimationFrame(function(){
                console.log('Fin')
            }, 10000);
        });
    }

    prepData() {
      this.edgeData = [];
      this.nodeData = [];

      this.maxStrength = 1;
      this.minStrength = false;

      this.nodeMap = {};
      this.sireMap = {};
      this.damMap = {};

      // this.data = _.filter(this.data, (d)=> d.breed == "HOLST");

      this.data.forEach((d)=>{
        if(d.sex == 'mare') {
          this.damMap[d.id] = d;
          d.links = [];
          d.progeny = [];
          return;
        }

        if(d.sex == 'stallion') {
          this.sireMap[d.id] = d;
        }
      });

      this.data.forEach((d)=>{
        this.addStrength(d.dam, d);
        if(d.sire) {
          let sire = this.sireMap[d.sire];
          if(sire && sire.dam) {
            this.addStrength(sire.dam, sire)
          }
        }
      });

      _.each(this.damMap,(d)=>{
        let dam = this.damMap[d.dam];
        if(d.breed !== 'HOLST') { return } //only add X breed
        if(!dam && d.progeny.length <= 1) { return } //remove singletons
        if(dam && dam.progeny.length == 1 && !d.progeny.length) { return }

        this.nodeMap[d.id] = d;
      });
      _.each(this.nodeMap, (d)=>{
        this.addEdge(d.dam, d.id);
        this.nodeData.push(d);
      })

      this.nodeData.forEach((d, i)=>{
        d.index = i;
      });

      this.radiusScale = d3.scaleLinear()
        .domain([this.minStrength, this.maxStrength])
        .range([3,20]);

      this.chargeScale = d3.scaleLinear()
        .domain([this.minStrength, this.maxStrength])
        .range([-30,0]);

      this.gravityScale = d3.scaleLinear()
        .domain([this.minStrength, this.maxStrength])
        .range([0,30]);

      this.linkStrengthScale = d3.scaleLinear()
        .domain([this.minStrength, this.maxStrength]);

    }

    addEdge(source, target) {
      let s = this.nodeMap[source];
      let t = this.nodeMap[target];
      if (!s || !t) { return };
      let edge = {
        id: source +'-'+ target,
        source: s,
        target: t
      };
      this.edgeData.push(edge);
      s.links.push(edge);
      t.links.push(edge);
    }

    addStrength(source, target) {
      let s = this.nodeMap[source];
      if(!s) { return; }
      s.strength = s.strength ? s.strength + 1 : 1;
      s.progeny.push(target);

      if(s.strength > this.maxStrength) {
        this.maxStrength = s.strength;
      }

      if(!this.minStrength || s.strength < this.minStrength) {
        this.minStrength = s.strength;
      }
    }


    startForce() {
        let ctx = this;
        debugger;
        let links = d3.forceLink(this.edgeData)
            // .strength(function(d){
            //     return ctx.linkStrengthScale(d.strength);
            // })
            .distance(function(){return 5});

        this.force = d3.forceSimulation(this.nodeData)
        .force("charge",  d3.forceManyBody().strength(function(d){
          return ctx.chargeScale(d.strength)
        }))
        .force("gravity",  d3.forceManyBody().strength(function(d){
          return ctx.gravityScale(d.strength)
        }))
        .force("collide", d3.forceCollide(function(d){
            return ctx.radiusScale(d.strength) + 10
        }))
        .force("center",  d3.forceCenter(this.w / 2, this.h / 2))
        // .force("link", links);
    }

    drawCircle(d,x,y,r,fill) {
        if (typeof fill === "string") {
            fill = parseInt(fill.substring(1), 16);
        }

        if (d._graphics) {
            d._graphics.clear();
        } else {
            d._graphics = new PIXI.Graphics();
        }

        d._graphics.lineStyle(0);
        d._graphics.beginFill(fill, 1);
        d._graphics.drawCircle(x,y,r);
        d._graphics.endFill();
        d._graphics.interactive = true;
        d._graphics.buttonMode = true;
        d._graphics.hitArea = new PIXI.Circle(x,y,r*1.5);

        return d._graphics;
    }

    drawEdge(d, x1,y1,x2,y2, highlight) {

        if (d._graphics) {
            d._graphics.clear();
        } else {
            d._graphics = new PIXI.Graphics();
        }

        let color = 0x999999;
        if (this.highlighting) {
            color = highlight ? 0x999999 : 0xffffff;
        } 
        let width = 1;
        d._graphics.lineStyle(width, color);
        d._graphics.alpha = 0.8;
        d._graphics.moveTo(x1,y1);
        d._graphics.lineTo(x2,y2);
        d._graphics.endFill();

        return d._graphics;
    }


    createEdge(d) {
       return this.drawEdge(d, d.source.x, d.source.y,d.target.x,d.target.y, 0);
    }

    createNode(d, color){
      let ctx = this;
      let circle = this.drawCircle(d, d.x, d.y, this.radiusScale(d.strength), (color || '#000000'));

      function recDrawEdge(node) {
        node.links.forEach(function(d){
          ctx.drawEdge(d, d.source.x, d.source.y,d.target.x,d.target.y, 1);
          ctx.edgeStage.addChild(d._graphics);
          if(node == d.source){
            recDrawEdge(d.target);
          } else {
            recDrawEdge(d.source)
          }
        })
      }

      d._graphics.click = function(e) {
        ctx.highlighting = true;
        ctx.edgeStage.removeChildren();
        if(ctx.lastClickedCircle !== this) {
            d.links.forEach(function(d){
              ctx.drawEdge(d, d.source.x, d.source.y,d.target.x,d.target.y, 1);
              ctx.edgeStage.addChild(d._graphics);
            });
            ctx.lastClickedCircle = this;
            console.log(d);
        } else {
            ctx.highlighting = false;
            ctx.lastClickedCircle = false;
            ctx.edgeData.forEach(function(d){
                let e = ctx.createEdge(d);
                if (e) {
                    ctx.edgeStage.addChild(e);
                }
            });
        }

        ctx.renderer.render(ctx.nodeStage);
      }

      return circle;
    }


  addDragNDrop() {
      let stage = this.nodeStage;
      stage.interactive = true;

      this.isDragging = false;
      this.prevX = 0;
      this.prevY = 0;

      let ctx = this;

      stage.mousedown = stage.touchstart = (e)=>{

          let pos = e.data.global;
          ctx.prevX = pos.x; 
          ctx.prevY = pos.y;
          ctx.isDragging = true;
      };

      stage.mousemove = stage.touchmove = (e)=>{
          if (!ctx.isDragging) {
              return;
          }
          let pos = e.data.global;
          let dx = pos.x - ctx.prevX;
          let dy = pos.y - ctx.prevY;

          stage.position.x += dx;
          stage.position.y += dy;
          this.prevX = pos.x; this.prevY = pos.y;

          requestAnimationFrame(function() { 
              ctx.renderer.render(stage); 
          });

      };

      stage.mouseup = stage.mouseupoutside = stage.touchend = stage.touchendoutside = (e)=>{
          ctx.isDragging = false;
      };
  }

  addZoom() {
    let stage = this.nodeStage;
    let ctx = this;

    function zoom(x, y, isZoomIn) {
        let direction = isZoomIn ? 1 : -1;
        let factor = (1 + direction * 0.1);
        stage.scale.x *= factor;
        stage.scale.y *= factor;

        requestAnimationFrame(function() { 
            ctx.renderer.render(stage); 
        });
    }

    let tZoom = _.throttle(zoom, 150)

    Wheel.addWheelListener(this.$container[0], function (e) {
        e.preventDefault();
        tZoom(e.clientX, e.clientY, e.deltaY < 0);
    });
  }

}