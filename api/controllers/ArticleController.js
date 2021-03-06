/**
 * ArticleController.js 
 *
 * @description ::
 * @docs        :: http://sailsjs.org/#!documentation/controllers
 */

function _error(msg, req, res, show_flash) {
  console.log('(!!) ERROR @ ' + req.options.controller + '/' + req.options.action);
  console.log(msg);
  if (show_flash) {
    req.session.flash = {
      type: 'error',
      msg: msg
    }
  }
  return res.redirect('/');
}

function _success(msg, req, res, return_url) {
  req.session.flash = {
    type: 'success',
    msg: msg
  }
  return res.redirect(return_url || '/');
}

module.exports = {

  index: function(req, res) {
    Article.find({sort: 'number ASC', law: req.param('law')}).exec(function(err, articles) {
      if (err) return res.send(500);
      return res.json(articles);
    });
  },

  find: function(req, res) {
    Law.findOne({slug: req.param('law_slug')})
    .populate('tag')
    .exec(function(err, law) {
      if (err) return _error(err, req, res, false);
      if (!law) return _error('Ley no encontrada', req, res, true);
      Article.findOne({
        number: req.param('article_number'),
        law: law.id
      }).exec(function(err, article) {
        if (err) return _error(err, req, res, false)
        if (!article) return _error('Articulo no encontrado', req, res, true);
        res.locals.layout = 'layoutv2';
        var tagged = law.tag ? true : false;
        return res.view('article/find', {article: article, law: law, tagged: tagged});
      });
    });
  },

  edit: function(req, res) {
    if (req.method == 'post' || req.method == 'POST') {
      var new_body = (typeof req.param('body') === 'undefined' || req.param('body') == null) ?
                     '' : req.param('body').trim();
      Article.findOne({id: req.param('article_id')})
      .exec(function(err, article) {
        if (err) return _error(err, req, res, false);
        if (!article) return _error('Artículo no encontrado', req, res, true);
        Article.isNumberOk('update', article, req.param('number'), req.param('law_id'), function(ok) {
          if (ok) {
            Article.update({
              id: article.id
            }, {
              number: req.param('number'),
              body: new_body,
            }).exec(function(err, articles) {
              if (err) return _error(err, req, res, false);
              if (!articles[0]) return _error('Articulo a editar no encontrado', req, res, true);
              var tagged = typeof req.param('tag_slug') !== 'undefined' ? true : false;
              var return_url = '/ley/' + req.param('law_slug') + '/articulo/' + req.param('number');
              if (tagged) {
                return_url = '/reforma/' + req.param('tag_slug') + return_url;
              }
              return _success('Artículo editado exitosamente', req, res, return_url);
            });
          } else {
            return _error('Error al actualizar artículo. Ya existe un artículo con ese número dentro de esta ley.', req, res, true);
          }
        });
      });
    } else if (req.method == 'get' || req.method == 'GET') {
      Law.findOne({slug: req.param('law_slug')})
      .populate('tag')
      .exec(function(err, law) {
        if (err) return _error('Error al buscar leyes', req, res, false);
        if (!law) return _error('Ley no encontrada', req, res, true);
        var tagged = law.tag ? true : false;
        Article.findOne({
          number: req.param('article_number'),
          law: law.id
        }).exec(function (err, article) {
          if (err) return _error(err, req, res, false);
          if (!article) return _error('Artículo no encontrado', req, res, true);
          article.body = (typeof article.body === 'undefined' || article.body == null) ?
                         '' : article.body.trim();
          Annotation.find({article: article.id}).exec(function(err, annotations) {
            res.locals.layout = 'layoutv2';
            return res.view('article/edit', {
              article         : article,
              law             : law,
              has_annotations : annotations.length > 0,
              tagged          : tagged
            });
          });
        });
      });
    }
  },
	
  create: function(req, res) {
    if (req.method == 'post' || req.method == 'POST') {
      Law.findOne({id: req.param('law')})
      .populate('articles')
      .populate('tag')
      .exec(function(err, law) {
        if (err) return _error(err, req, res, false);
        if (!law) return _error('Ley no encontrada', req, res, true);
        Article.isNumberOk('create', {}, req.param('number'), req.param('law'), function(ok) {
          if (ok) {
            Article.create({
              law: req.param('law'),
              number: req.param('number'),
              body: req.param('body')
            }).exec(function(err, article) {
              if (err) return _error(err, req, res, false);
              var return_url = '/ley/' + law.slug + '/articulo/' + req.param('number');
              if (law.tag) {
                return_url = '/reforma/' + law.tag.slug + return_url;
              }
              return _success('Artículo creado exitosamente', req, res, return_url);
            });
          } else {
            return _error('Error al crear artículo. Ya existe un artículo con ese número dentro de esta ley.', req, res, true);
          }
        });
      });
    } else if (req.method == 'get' || req.method == 'GET') {
      var args = {};
      var direct = false;

      // Check if the request came from the law's "find" view.
      if (typeof req.param('law_id') != 'undefined') {
        args = req.param('law_id');
        direct = true;
      }

      Law.find(args).exec(function(err, laws) {
        if (err) return _error(err, req, res, false);
        res.locals.layout = 'layoutv2';
        return res.view('article/create', {laws: laws, direct: direct});
      });
    }
  },

  search: function(req, res) {
    Law.findOne({id: req.param('law')})
    .populate('tag')
    .exec(function(err, law) {
      if (err) return _error(err, req, res, false);
      if (!law) return _error('Ley inexistente', req, res, true);
      Article.find({
        sort: 'number ASC',
        law: req.param('law')
      })
      .where({
        'body': {contains: req.param('text')},
      })
      .populate('annotations')
      .exec(function(err, articles) {
        if (err) return _error(err, req, res, false);
        if (!articles) articles = []
        res.locals.layout = 'layoutv2';
        return res.view('law/find', {law: law, articles: articles, searchTerm: req.param('text')})
      });
    });
  },

  destroy: function(req, res) {
    Article.destroy({
      id: req.param('id')
    }).exec(function(err, article) {
      if (err) return _error(err, req, res, false);
      return _success('Artículo borrado exitosamente', req, res, req.param('origin'));
    });
  },

};
