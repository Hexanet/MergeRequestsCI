module.exports = function() {

 return function() {
   var favico = new Favico({
     animation : 'fade'
   });

   this.badge = function(num) {
     favico.badge(num);
   };

   this.reset = function() {
     favico.reset();
   };
 }

};
