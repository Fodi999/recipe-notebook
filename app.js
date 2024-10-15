const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // Подключаем uuid для генерации id
const app = express();
const upload = multer({ dest: 'public/uploads/' }); // Папка для загрузки фотографий

let recipes = require('./recipes.json'); // Загрузка данных рецептов из JSON

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Функция для очистки папки uploads
function cleanUploads() {
  const uploadsDir = path.join(__dirname, 'public', 'uploads');

  fs.readdir(uploadsDir, (err, files) => {
    if (err) {
      console.error(`Ошибка чтения папки uploads: ${err}`);
      return;
    }

    // Список всех фото, которые используются в рецептах
    const usedPhotos = recipes.map(recipe => recipe.photo).filter(photo => photo);

    // Проверяем каждый файл в папке uploads
    files.forEach(file => {
      if (!usedPhotos.includes(file)) {
        // Файл не используется, удаляем его
        const filePath = path.join(uploadsDir, file);
        fs.unlink(filePath, (err) => {
          if (err) {
            console.error(`Ошибка при удалении файла: ${filePath}`, err);
          } else {
            console.log(`Файл успешно удален: ${filePath}`);
          }
        });
      }
    });
  });
}

// Очищаем папку uploads при запуске приложения
cleanUploads();

// Главная страница
app.get('/', (req, res) => {
  const fishDishes = recipes.filter(recipe => recipe.category === 'fish');
  const meatDishes = recipes.filter(recipe => recipe.category === 'meat');
  const sauces = recipes.filter(recipe => recipe.category === 'sauce');

  if (req.xhr) {  // Если это AJAX-запрос, возвращаем только контент
    res.render('index', { fishDishes, meatDishes, sauces });
  } else {  // Если это обычный запрос, рендерим с layout
    res.render('layout', { body: 'index', fishDishes, meatDishes, sauces });
  }
});

// Страница для добавления рецепта
app.get('/add-recipe', (req, res) => {
  if (req.xhr) {
    res.render('add-recipe', { recipes });
  } else {
    res.render('layout', { body: 'add-recipe', recipes });
  }
});

// Обработка добавления нового рецепта
app.post('/add-recipe', upload.single('photo'), (req, res) => {
  const newRecipe = {
    id: uuidv4(), // Генерация уникального id
    title: req.body.title,
    category: req.body.category, // Категория рецепта
    ingredients: req.body.ingredients,
    ingredientWeights: req.body.ingredientWeights,
    totalWeight: req.body.totalWeight,
    preparation: req.body.description,
    photo: req.file ? req.file.filename : null
  };

  recipes.push(newRecipe); // Добавляем новый рецепт в массив

  // Сохраняем массив рецептов в JSON-файл
  fs.writeFileSync('./recipes.json', JSON.stringify(recipes, null, 2));

  console.log(`Рецепт "${newRecipe.title}" успешно добавлен с id: ${newRecipe.id}`);

  res.redirect('/');
});

// Маршрут для удаления рецепта
app.post('/delete-recipe/:id', (req, res) => {
  const recipeId = req.params.id;
  const recipeIndex = recipes.findIndex(recipe => recipe.id === recipeId);

  if (recipeIndex === -1) {
    console.error(`Рецепт с id ${recipeId} не найден для удаления.`);
    return res.status(404).json({ error: 'Рецепт не найден' }); // Отправляем JSON-ответ вместо редиректа
  }

  const recipe = recipes[recipeIndex];

  // Проверка, существует ли фото
  if (recipe.photo) {
    const photoPath = path.join(__dirname, 'public', 'uploads', recipe.photo);

    // Проверяем наличие файла перед удалением
    fs.access(photoPath, fs.constants.F_OK, (err) => {
      if (!err) {
        fs.unlink(photoPath, (err) => {
          if (err) {
            console.error(`Ошибка при удалении фото: ${err}`);
          } else {
            console.log(`Фото ${recipe.photo} успешно удалено.`);
          }
        });
      } else {
        console.log(`Фото ${recipe.photo} уже не существует.`);
      }
    });
  }

  // Удаляем рецепт из массива
  recipes.splice(recipeIndex, 1);

  // Сохраняем изменения в JSON-файле
  fs.writeFileSync('./recipes.json', JSON.stringify(recipes, null, 2));

  // Отправляем ответ без редиректа
  res.json({ success: true });
});



// Маршрут для редактирования рецепта
app.get('/edit-recipe/:id', (req, res) => {
  const recipeId = req.params.id;
  const recipe = recipes.find(recipe => recipe.id === recipeId);

  if (!recipe) {
    console.error(`Рецепт с id ${recipeId} не найден для редактирования.`);
    return res.status(404).send('Рецепт не найден');
  }

  if (req.xhr) {
    res.render('edit-recipe', { recipe });
  } else {
    res.render('layout', { body: 'edit-recipe', recipe });
  }
});

// Обработка редактирования рецепта
app.post('/edit-recipe/:id', upload.single('photo'), (req, res) => {
  const recipeId = req.params.id;
  const recipeIndex = recipes.findIndex(recipe => recipe.id === recipeId);

  if (recipeIndex === -1) {
    console.error(`Рецепт с id ${recipeId} не найден для обновления.`);
    return res.status(404).send('Рецепт не найден');
  }

  const updatedRecipe = {
    ...recipes[recipeIndex], // Сохраняем оригинальный id и другие неизменные поля
    title: req.body.title,
    ingredients: req.body.ingredients, // Массив ингредиентов
    ingredientWeights: req.body.ingredientWeights, // Массив весов ингредиентов
    totalWeight: req.body.totalWeight, // Общий вес
    preparation: req.body.description, // Описание приготовления
    photo: req.file ? req.file.filename : recipes[recipeIndex].photo // Обновляем фото, если загружено новое
  };

  // Обновляем рецепт в массиве
  recipes[recipeIndex] = updatedRecipe;

  // Сохраняем обновленный рецепт в JSON
  fs.writeFileSync('./recipes.json', JSON.stringify(recipes, null, 2));

  console.log(`Рецепт "${updatedRecipe.title}" успешно обновлен.`);

  res.redirect('/');
});

// Маршрут для отображения рецепта
app.get('/recipe/:id', (req, res) => {
  const recipeId = req.params.id;
  const recipe = recipes.find(recipe => recipe.id === recipeId);

  if (!recipe) {
    console.error(`Рецепт с id ${recipeId} не найден для отображения.`);
    return res.status(404).send('Рецепт не найден');
  }

  if (req.xhr) {
    res.render('recipe-detail', { recipe });
  } else {
    res.render('layout', { body: 'recipe-detail', recipe });
  }
});

// Запуск сервера
app.listen(3000, () => {
  console.log('Сервер запущен на http://localhost:3000');
});





