from django.db import models
from django.contrib.auth.models import User

class Habit(models.Model):
    name = models.CharField(max_length=255)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='habits', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return self.name

class HabitLog(models.Model):
    habit_fk = models.ForeignKey(Habit, on_delete=models.CASCADE, related_name='logs')
    date = models.DateField()
    is_done = models.BooleanField(default=False)

    class Meta:
        unique_together = ('habit_fk', 'date')
        ordering = ['date']

    def __str__(self):
        return f"{self.habit_fk.name} - {self.date}: {'Done' if self.is_done else 'Not Done'}"
