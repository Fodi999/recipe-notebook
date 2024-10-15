document.addEventListener('DOMContentLoaded', () => {
  // Логика для смены фона
  const changeBgButton = document.getElementById('change-bg');
  
  if (changeBgButton) {
    changeBgButton.addEventListener('click', (event) => {
      event.preventDefault();
      const colors = ['#f8b400', '#4caf50', '#2196f3', '#e91e63', '#9c27b0'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      document.body.style.backgroundColor = randomColor;
    });
  }

  // Логика для активации иконок при клике
  const iconWrappers = document.querySelectorAll('.icon-wrapper');
  const navLinks = document.querySelectorAll('.nav-link');

  if (iconWrappers.length > 0) {
    navLinks.forEach(link => {
      link.addEventListener('click', function (event) {
        event.preventDefault();

        iconWrappers.forEach(wrapper => wrapper.classList.remove('active'));
        this.querySelector('.icon-wrapper').classList.add('active');
      });
    });
  }

  // Логика для динамической загрузки страниц без перезагрузки
  const links = document.querySelectorAll('[data-link]');
  const content = document.getElementById('content');
  
  if (links.length > 0) {
    links.forEach(link => {
      link.addEventListener('click', async (event) => {
        event.preventDefault();
        const url = link.getAttribute('href');
    
        try {
          const response = await fetch(url, {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
          });
          const html = await response.text();
          
          if (html) {
            content.innerHTML = html;
            window.history.pushState(null, '', url);
          }
        } catch (error) {
          console.error('Ошибка загрузки страницы:', error);
        }
      });
    });
  }

  // Логика для добавления и удаления ингредиентов
  const setupIngredientButton = () => {
    const addIngredientButton = document.getElementById('add-ingredient');
    const ingredientsSection = document.getElementById('ingredients-section');
    const totalWeightField = document.getElementById('total-weight');

    if (addIngredientButton && ingredientsSection) {
      console.log("Кнопка 'Добавить ингредиент' найдена!");

      const updateTotalWeight = () => {
        const weightFields = document.querySelectorAll('input[name="ingredientWeights[]"]');
        let totalWeight = 0;
        weightFields.forEach(field => {
          const weight = parseFloat(field.value) || 0;
          totalWeight += weight;
        });
        totalWeightField.value = totalWeight.toFixed(3);
      };

      const removeIngredient = (event) => {
        const ingredientField = event.target.closest('.ingredient-field');
        if (ingredientField) {
          ingredientField.remove();
          updateTotalWeight();
        }
      };

      addIngredientButton.addEventListener('click', function () {
        console.log("Кнопка 'Добавить ингредиент' нажата!");

        const newIngredientDiv = document.createElement('div');
        newIngredientDiv.classList.add('ingredient-field');

        const newIngredientField = document.createElement('input');
        newIngredientField.type = 'text';
        newIngredientField.name = 'ingredients[]';
        newIngredientField.placeholder = 'Ингредиент';
        newIngredientField.required = true;

        const newWeightField = document.createElement('input');
        newWeightField.type = 'number';
        newWeightField.name = 'ingredientWeights[]';
        newWeightField.placeholder = 'Вес в граммах';
        newWeightField.step = '0.001';
        newWeightField.required = true;

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.textContent = 'Удалить';
        removeButton.classList.add('remove-ingredient');
        removeButton.addEventListener('click', removeIngredient);

        newIngredientDiv.appendChild(newIngredientField);
        newIngredientDiv.appendChild(newWeightField);
        newIngredientDiv.appendChild(removeButton);
        ingredientsSection.appendChild(newIngredientDiv);

        newWeightField.addEventListener('input', updateTotalWeight);
      });

      document.querySelectorAll('input[name="ingredientWeights[]"]').forEach(field => {
        field.addEventListener('input', updateTotalWeight);
      });

      document.querySelectorAll('.remove-ingredient').forEach(button => {
        button.addEventListener('click', removeIngredient);
      });
    } else {
      console.error("Кнопка 'Добавить ингредиент' или секция для ингредиентов не найдены!");
    }
  };

  const observer = new MutationObserver(() => {
    setupIngredientButton();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Логика для удаления рецепта
  const deleteForms = document.querySelectorAll('.delete-form');
  deleteForms.forEach(form => {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      const confirmed = confirm('Вы уверены, что хотите удалить этот рецепт?');
      if (confirmed) {
        const recipeId = form.getAttribute('data-id');
        if (!recipeId) {
          console.error('ID рецепта не найден.');
          return;
        }
        fetch(`/delete-recipe/${recipeId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
        .then(response => {
          if (response.ok) {
            form.closest('.recipe-detail').remove(); // Удаляем элемент карточки рецепта
            console.log(`Рецепт с id ${recipeId} был успешно удален.`);
          } else {
            console.error('Ошибка при удалении рецепта');
          }
        })
        .catch(error => console.error('Ошибка удаления рецепта:', error));
      }
    });
  });

  // Логика для редактирования рецепта
  const editButtons = document.querySelectorAll('.btn-edit');
  editButtons.forEach(button => {
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      const url = button.getAttribute('href');

      try {
        const response = await fetch(url, {
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        const html = await response.text();
        content.innerHTML = html;
        window.history.pushState(null, '', url);
      } catch (error) {
        console.error('Ошибка загрузки страницы для редактирования:', error);
      }
    });
  });
});











  

  
  