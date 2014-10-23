var slugs = require("slug");

exports.enhanceSchema = function(schema, options)
{
  if (options.source === undefined)
  {
    options.source = 'title';
  }

  if (options.substitute === undefined)
  {
    options.substitute = '-';
  }

  if (!options.addSlugManually) 
  {
    schema.add({ slug: { type: String, unique: true } });
  }  


  // "Wait, how does the slug become unique?" See enhanceModel below. We add digits to it
  // if and only if there is an actual error on save. This approach is concurrency safe
  // unlike the usual "hope nobody else makes a slug while we're still saving" strategy
  schema.pre('save', function (next) {
    var self = this;
    if (self.get('slug') === undefined)
    {
      // Come up with a unique slug, even if the title is not unique
      var originalSlug = self.get(options.source);
      //originalSlug = originalSlug.toLowerCase().replace(options.disallow, options.substitute);
      originalSlug = slugs(originalSlug).toLowerCase();
      self.set('slug', originalSlug);
    }
    next();
  });
};

exports.enhanceModel = function(model, options)
{
  if (options === undefined)
  {
    options = {}
  }
  if (options.substitute === undefined)
  {
    options.substitute = '-';
  }
  // Stash the original 'save' method so we can call it
  model.prototype.saveAfterExtendSlugOnUniqueIndexError = model.prototype.save;
  // Replace 'save' with a wrapper
  model.prototype.save = function(f, slugCounter)
  {
    var self = this;
    slugCounter = slugCounter || 1;
    // Our replacement callback
    var extendSlugOnUniqueIndexError = function(err, d)
    {
      if (err) 
      {
        // Spots unique index errors relating to the slug field
        if ((err.code === 11000) && (err.err.indexOf('slug') !== -1))
        {
          self.slug += options.substitute + (Math.floor(Math.random() * 10)).toString();
          // Necessary because otherwise Mongoose doesn't allow us to retry save(),
          // at least until https://github.com/punkave/mongoose/commit/ea37acc8bd216abec68033fe9e667afa5fd9764c
          // is in the mainstream release
          self.isNew = true;
          self.save(extendSlugOnUniqueIndexError);
          return;
        }
      }
      // Not our special case so call the original callback
      f(err, d);
    };
    // Call the original save method, with our wrapper callback
    self.saveAfterExtendSlugOnUniqueIndexError(extendSlugOnUniqueIndexError);
  }
};
