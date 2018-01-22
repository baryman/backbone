var ALL_CARS = Cars,
    SelectCarsView,
    TestBackbone = Backbone.View.extend({
        el: $('.car-block'),

        selectCarsView: {},
        selectModelView: {},

        initialize: function () {
            this.startSelect();
        },

        startSelect: function () {
            this.selectBrandView = new SelectBrandView();
            this.listenTo(this.selectBrandView, 'brandSelected', this.brandSelected);
            this.selectBrandView.render(ALL_CARS);
        },

        brandSelected: function(brand){
            this.selectModelView = new SelectModelView();
            this.listenTo(this.selectModelView, 'modelSelected', this.modelSelected);
            this.selectModelView.render(ALL_CARS[brand]);
        },

        // modelSelected: function(model){
        //     this.selectBodyView = new SelectBodyView;
        //     this.selectBodyView.render(ALL_CARS[])
        // }

    });
    
    
    

//Модель человека

SelectBrandView = Backbone.View.extend({
    
    events: {
        'change': 'selectChange'
    },

    selectChange: function (){
        var selected_brand = this.$(':selected').data('car_brand');

        this.trigger('brandSelected', selected_brand);
    },

    render: function (data) {
        var cars = data,
            template = _.template($('#cars-select').html());
        
        $('.car-block').html(template({
            cars: cars
        }));
        // Задаем $el, который срендерили
        this.setElement('#cars-select_brand');
        this.$el.SumoSelect();
    }
    
});

SelectModelView = Backbone.View.extend({
    events: {
        'change': 'selectChange'
    },

    selectChange: function(){
        var  selected_model = this.$(':selected').data('car_model');
            this.trigger('modelSelected', selected_model);
    },
    render: function(selectedBrand){
        var models = selectedBrand.models,
            template = _.template($('#model-select').html());


        $('.model-block').html(template({
            models: models
        }));

        this.setElement('#cars-select_model');
        this.$el.SumoSelect();

    }
});

new TestBackbone;


// Person = Backbone.Model.extend({
//     defaults: {
//         name: 'Maxim',
//         age: 20,
//         job: 'Web-developer'
//     }
// });

// Вид представления одного человека
// PersonView = Backbone.View.extend({
//
// 	el: $('.test'),
//
//     model: new Person,
//
//     template: '#person-id',
//
// 	events: {
// 		'dblclick': 'eventClick'
// 	},
//
//     eventClick: function() {
// 		var self = this,
// 		    msg = 'PersonView';
//
//         self.trigger('alertUp', this.model);
//     },
//
// 	render: function(){
//
// 		// 1 Способ (не стоит так делать)
// 		//this.$el.html(this.model.get('name') + '('+ this.model.get('age') + ') - ' + this.model.get('job'));
//
// 		// 2 способ
// 		//this.$el.html(this.template(this.model.toJSON()));
//
// 		// 3 способ
// 		var template = _.template($(this.template).html());
//
// 		this.$el.html(template(this.model.toJSON()));
//
// 	}
// });





/*
var person = new Person;
var personView = new PersonView({model: person});


var person2 = new Person({name: 'Andrey', age: 27});
var personView2 = new PersonView({model: person2});
*/

// var peopleCollection = new PeopleCollection([
// 	{
// 		name: 'Иван',
// 		age: 20,
// 		job: 'Таксист'
// 	},
// 	{
// 		name: 'Анна',
// 		age: 19,
// 		job: 'Студент'
// 	},
// 	{
// 		name: 'Павел',
// 		age: 15,
// 		job: 'Школьник'
// 	}
// ]);
/*
peopleCollection.add(person);
peopleCollection.add(person2);
*/