
// Модель человека
var Person = Backbone.Model.extend({
	defaults: {
		name: 'Maxim',
		age: 20,
		job: 'Web-developer'
	}
});


// Список людей
var PeopleCollection = Backbone.Collection.extend({
	model: Person
});


// Вид представления одного человека
var PersonView = Backbone.View.extend({
	initialize: function(){
		this.render();
	},
	tagName: 'li',
	// 2 способ
	//template: _.template($('#person-id').html()),

	// 3 способ
	template: '#person-id',
	render: function(){

		// 1 Способ (не стоит так делать)
		//this.$el.html(this.model.get('name') + '('+ this.model.get('age') + ') - ' + this.model.get('job'));
		
		// 2 способ
		//this.$el.html(this.template(this.model.toJSON()));

		// 3 способ
		var template = _.template($(this.template).html());
		this.$el.html(template(this.model.toJSON()));


	}
});
/*
var person = new Person;
var personView = new PersonView({model: person});


var person2 = new Person({name: 'Andrey', age: 27});
var personView2 = new PersonView({model: person2});
*/

var peopleCollection = new PeopleCollection([
	{
		name: 'Иван',
		age: 20,
		job: 'Таксист'
	},
	{
		name: 'Анна',
		age: 19,
		job: 'Студент'
	},
	{
		name: 'Павел',
		age: 15,
		job: 'Школьник'
	}
]);
/*
peopleCollection.add(person);
peopleCollection.add(person2);
*/