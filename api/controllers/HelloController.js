/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
module.exports = {
    index: function (req, res) {
//        var helloMessage = TestService.sayHello();
//        res.send('Our service has a message for you: ' + helloMessage);
        
        TestService.sayHello('Vineeth',function(result){
            res.send('Our service has a message for you: ' + result);
        });
    }

};

