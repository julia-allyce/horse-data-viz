import $ from 'jquery';
import Visual from 'hdv/js/visual';
import _ from 'lodash';

let vis = new Visual();
let horseData = [];

$.getJSON('horses.json').done((data)=>{
  console.log('Got ' + data.length + ' horses :D');
  horseData = data;
  $('#render').attr('disabled', false);
  $('#render').html('Ready to Render');
});

$('#render').click(()=>{
  let data = _.filter(horseData, (d,i)=> { 
    return (d.breed == 'HOLST' && d.yob > 1990 && d.sex == 'stallion');
  })
  console.log('Filtered data: ', data.length)
  vis.renderGraph(data);
})