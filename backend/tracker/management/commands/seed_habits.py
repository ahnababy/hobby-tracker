import datetime
from django.core.management.base import BaseCommand
from tracker.models import Habit, HabitLog

class Command(BaseCommand):
    help = 'Seeds default habits and initial sample log data'

    def handle(self, *args, **options):
        habits_data = [
            "Drank Water (8 glasses)",
            "Read 10 pages",
            "30 Min Workout",
            "Morning Meditation",
            "Code Hobby Project"
        ]

        today = datetime.date.today()
        # Find Monday of current week
        start_of_week = today - datetime.timedelta(days=today.weekday())

        for habit_name in habits_data:
            habit, created = Habit.objects.get_or_create(name=habit_name)
            if created:
                self.stdout.write(self.style.SUCCESS(f"Created habit: '{habit_name}'"))
            
            # Create sample logs for past days in current week
            for day_offset in range(7):
                log_date = start_of_week + datetime.timedelta(days=day_offset)
                if log_date <= today:
                    # Mark some random sample past days as done for rich visual demo
                    is_done = (log_date.day + len(habit_name)) % 2 == 0
                    HabitLog.objects.get_or_create(
                        habit_fk=habit,
                        date=log_date,
                        defaults={'is_done': is_done}
                    )

        self.stdout.write(self.style.SUCCESS('Successfully seeded habits and log data.'))
