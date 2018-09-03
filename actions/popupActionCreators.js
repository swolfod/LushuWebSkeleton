"use strict";

var React = require('react');
var BaseActionCreators = require("flux/actionCreators");


class PopupActionCreators extends BaseActionCreators {
  constructor(options) {
    super(options);

    this.generateDirectActions(
      "pop",
      "close",
      'alert',
      'confirm',
      'prompt',
    );


    //this.generateAsyncActions(
    //"getRecycleList",
    //"restoreRecycleItem"
    //);

  }
  doConfirm(content) {
    return new Promise((resolve, reject) => {

    });
  }
  doAlert(content, title) {}
  doPrompt(content, title) {
    //return this.prompt(content,{title});
    var that = this;
    return new Promise(function(resolve, reject) {
      var r;
      var oldClose = content.props&&content.props.onClose;
      var oldCancel = content.props&&content.props.onCancel;
      var newContent = React.cloneElement(content, {
        onClose: function(result) {
          that.close(r);
          if(oldClose){
            oldClose();
          }
          resolve(...arguments);
        },
        onCancel: function() {
          if(oldCancel){
            oldCancel();
          }
          that.close(r);
          reject(...arguments);
        }
      });
      r = that.prompt(newContent);
      //console.log(r);
    });
  }
}

module.exports = PopupActionCreators;
